import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetTemplate, allFoundationalApproved, stage1FoundationalApproved } from "@/config/assets";
import { generateAssetContent, ANTHROPIC_MODEL } from "@/lib/anthropic/generate";
import { generatePerplexityContent, PERPLEXITY_MODEL } from "@/lib/perplexity/generate";
import { generateImages } from "@/lib/openai/generateImage";
import { buildDefaultImagePrompt, buildCalendarPostImagePrompt } from "@/lib/assets/buildImagePrompt";
import { parseCalendarJson, buildCalendarXlsx } from "@/lib/calendar/buildCalendarXlsx";
import { resolveSystemPrompt } from "@/lib/assets/resolvePrompt";
import { stripCodeFence } from "@/lib/assets/stripCodeFence";
import { generateGammaPptx } from "@/lib/gamma/generate";
import { createHeygenVideo, extractAvatarScript } from "@/lib/heygen/generate";
import { buildStyledDocx } from "@/lib/docx/buildStyledDocx";
import type { GeneratedAsset } from "@/types/database";

// The content calendar generates one image per post (12-16 calls, run in
// parallel) on top of the text generation itself -- comfortably longer
// than Vercel's default function timeout. Requires a plan/config that
// honors this (Hobby caps lower regardless of this setting).
export const maxDuration = 180;

export async function POST(request: Request) {
  const supabase = createClient();

  // Only authenticated team members can trigger generation — this is the
  // cost/abuse gate. The public onboarding form never calls this route.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { projectId, assetKey } = await request.json();

  if (!projectId || !assetKey) {
    return NextResponse.json(
      { error: "Missing projectId or assetKey" },
      { status: 400 }
    );
  }

  const template = getAssetTemplate(assetKey);
  if (!template) {
    return NextResponse.json({ error: "Unknown asset" }, { status: 400 });
  }

  const { data: onboarding } = await supabase
    .from("onboarding_responses")
    .select("answers")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!onboarding) {
    return NextResponse.json(
      { error: "No onboarding answers found for this project" },
      { status: 400 }
    );
  }

  const { data: projectRow } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();

  const effectiveSystemPrompt = await resolveSystemPrompt(
    supabase,
    template.id,
    projectRow?.client_id ?? null
  );

  // Marketing-tier assets are locked until every foundational document is
  // approved. This check happens server-side, not just in the UI, so it
  // can't be bypassed by calling this route directly.
  if (template.tier === "marketing") {
    const { data: existingAssets } = await supabase
      .from("generated_assets")
      .select("asset_key, approval_status")
      .eq("project_id", projectId)
      .returns<Pick<GeneratedAsset, "asset_key" | "approval_status">[]>();

    if (!allFoundationalApproved(existingAssets ?? [])) {
      return NextResponse.json(
        {
          error:
            "This asset is locked until all foundational documents (ICP, Brand Identity, Brand Guidelines, Messaging Framework) are approved.",
        },
        { status: 403 }
      );
    }
  }

  // Stage 2 foundational assets (Brand Guidelines, Messaging Framework)
  // are normally only ever generated automatically once Stage 1 (ICP,
  // Brand Identity) is fully approved -- see the auto-trigger in
  // app/api/assets/review/route.ts. This blocks someone from generating a
  // Stage 2 asset directly/early by calling this route with its assetKey
  // before that's happened, same server-side-not-just-UI principle as the
  // marketing-tier gate above.
  if (template.tier === "foundational" && template.foundationalStage === 2) {
    const { data: existingAssets } = await supabase
      .from("generated_assets")
      .select("asset_key, approval_status")
      .eq("project_id", projectId)
      .returns<Pick<GeneratedAsset, "asset_key" | "approval_status">[]>();

    if (!stage1FoundationalApproved(existingAssets ?? [])) {
      return NextResponse.json(
        {
          error:
            "This asset is locked until both Stage 1 documents (ICP, Brand Identity) are approved.",
        },
        { status: 403 }
      );
    }
  }

  const userPrompt = template.buildUserPrompt(onboarding.answers);

  const { data: assetRow, error: insertError } = await supabase
    .from("generated_assets")
    .insert({
      project_id: projectId,
      asset_key: template.id,
      status: "generating",
      prompt_snapshot: userPrompt,
      // foundational assets start their approval lifecycle as "pending"
      // once content lands; marketing assets never require approval.
      approval_status: template.tier === "foundational" ? "pending" : "not_required",
    })
    .select("id")
    .single();

  if (insertError || !assetRow) {
    return NextResponse.json(
      { error: insertError?.message ?? "Could not create asset row" },
      { status: 500 }
    );
  }

  try {
    const generate =
      template.provider === "perplexity" ? generatePerplexityContent : generateAssetContent;
    const modelUsed = template.provider === "perplexity" ? PERPLEXITY_MODEL : ANTHROPIC_MODEL;

    let content = await generate(
      effectiveSystemPrompt,
      userPrompt,
      template.maxTokens ?? 4000
    );

    // Safety net for HTML assets: Claude sometimes wraps code in a markdown
    // fence despite explicit instructions not to. A stray ```html at the
    // top would break a direct paste into GHL's Custom HTML element, so
    // strip a leading/trailing fence if present. (Calendar JSON gets the
    // same treatment inside parseCalendarJson, right before its own
    // JSON.parse. Deck-file assets are Markdown now, not JSON -- see the
    // deck-build block below.)
    if (template.outputFormat === "html") {
      content = stripCodeFence(content);
    }

    // Capture the spoken-only monologue BEFORE cleaning the display copy
    // below — extractAvatarScript needs the raw <<<AVATAR_SCRIPT>>> markers
    // intact, but nobody reading the stored/downloaded document should see
    // those markers verbatim.
    const avatarScriptForHeygen = template.supportsHeygenVideo
      ? extractAvatarScript(content)
      : null;
    if (template.supportsHeygenVideo) {
      content = content
        .replace(
          /<<<AVATAR_SCRIPT>>>/g,
          "\n### Avatar Script (performed verbatim by the AI avatar)\n"
        )
        .replace(/<<<END_AVATAR_SCRIPT>>>/g, "");
    }

    await supabase
      .from("generated_assets")
      .update({
        status: "complete",
        content,
        model_used: modelUsed,
        generated_at: new Date().toISOString(),
      })
      .eq("id", assetRow.id);

    // Only advance status forward from onboarding_complete — a project
    // already mid-generation for another asset shouldn't get bumped back.
    await supabase
      .from("projects")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("status", "onboarding_complete");

    // For image-capable assets, generate one default image automatically
    // alongside the text — one "Generate" click produces both. This is
    // best-effort: an image failure here does NOT fail the text generation,
    // which already succeeded. The custom-prompt "Regenerate" control in
    // the UI lets someone retry or redirect the image afterward regardless.
    if (template.supportsImage) {
      try {
        const imagePrompt = buildDefaultImagePrompt(template, onboarding.answers, content);
        const [base64Image] = await generateImages(
          imagePrompt,
          1,
          template.imageSize ?? "1024x1024"
        );
        const buffer = Buffer.from(base64Image, "base64");
        const storagePath = `${projectId}/${template.id}/${crypto.randomUUID()}.png`;

        const { error: uploadError } = await supabase.storage
          .from("asset-images")
          .upload(storagePath, buffer, { contentType: "image/png" });

        if (!uploadError) {
          await supabase.from("asset_files").insert({
            generated_asset_id: assetRow.id,
            format: "png",
            storage_path: storagePath,
          });
        }
      } catch {
        // Swallow — text generation already succeeded and was returned to
        // the user; a failed default image just means the Images section
        // will show empty with the option to generate manually.
      }
    }

    // For deck-file assets, hand Claude's Markdown outline to Gamma, which
    // designs and exports the actual .pptx (see the note at the top of
    // lib/gamma/generate.ts -- this path is written to Gamma's documented
    // API but hasn't been runtime-verified against a live key yet).
    // Best-effort, same pattern as images/pptx used to be: a failure here
    // does not fail the text generation, which already succeeded and is
    // what the approval/review flow actually reads.
    if (template.supportsDeckFile) {
      try {
        const slideCount = (content.match(/^##\s/gm) ?? []).length || undefined;
        const pptxBuffer = await generateGammaPptx(content, {
          numCards: slideCount,
          title: template.label,
        });
        const storagePath = `${projectId}/${template.id}/${crypto.randomUUID()}.pptx`;

        const { error: uploadError } = await supabase.storage
          .from("asset-documents")
          .upload(storagePath, pptxBuffer, {
            contentType:
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          });

        if (!uploadError) {
          await supabase.from("asset_files").insert({
            generated_asset_id: assetRow.id,
            format: "pptx",
            storage_path: storagePath,
          });
        }
      } catch {
        // Swallow — text (Markdown outline) generation already succeeded;
        // a failed Gamma build just means no download file yet. Most
        // likely causes: GAMMA_API_KEY missing/invalid, or the Gamma
        // generation timed out — check server logs for the real error.
      }
    }

    // For script assets flagged supportsHeygenVideo, kick off an async
    // HeyGen render of just the spoken monologue (extracted from the full
    // text via the <<<AVATAR_SCRIPT>>> markers — see
    // lib/heygen/generate.ts). This only STARTS the render and stores the
    // returned video_id; the actual mp4 arrives later via
    // app/api/webhooks/heygen/route.ts once HeyGen finishes (HeyGen's own
    // docs say rendering can take several minutes, too long to hold this
    // request open for). Same best-effort pattern as everything else here:
    // a failure to even start the render doesn't touch the text generation,
    // which already succeeded.
    if (template.supportsHeygenVideo) {
      try {
        if (avatarScriptForHeygen) {
          const videoId = await createHeygenVideo(avatarScriptForHeygen, {
            title: template.label,
            callbackId: assetRow.id,
          });
          await supabase
            .from("generated_assets")
            .update({ heygen_video_id: videoId })
            .eq("id", assetRow.id);
        } else {
          console.error(
            `HeyGen video skipped for asset ${assetRow.id}: no <<<AVATAR_SCRIPT>>> block found in generated content`
          );
        }
      } catch (err) {
        console.error(
          `HeyGen video render failed to start for asset ${assetRow.id}:`,
          err instanceof Error ? err.message : err
        );
        // Swallow — text generation already succeeded; a failed render
        // kickoff just means no video for this asset. Most likely causes:
        // HEYGEN_API_KEY missing/invalid, or no avatars/voices available
        // on the account.
      }
    }

    // For assets flagged supportsBrandedDocx, build a real, cleanly
    // formatted .docx from the Markdown content (see
    // lib/docx/buildStyledDocx.ts) so there's an actual downloadable file,
    // not just plain text in the dashboard. Same best-effort pattern as
    // every other file-build step here.
    if (template.supportsBrandedDocx) {
      try {
        const docxBuffer = await buildStyledDocx(template.label, content);
        const storagePath = `${projectId}/${template.id}/${crypto.randomUUID()}.docx`;

        const { error: uploadError } = await supabase.storage
          .from("asset-documents")
          .upload(storagePath, docxBuffer, {
            contentType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });

        if (!uploadError) {
          await supabase.from("asset_files").insert({
            generated_asset_id: assetRow.id,
            format: "docx",
            storage_path: storagePath,
          });
        }
      } catch (err) {
        console.error(
          `Branded docx build failed for asset ${assetRow.id}:`,
          err instanceof Error ? err.message : err
        );
        // Swallow — text generation already succeeded; a failed docx build
        // just means no formatted download yet, same as every other
        // secondary file-build step.
      }
    }

    // For the content calendar, generate one image per post (in parallel --
    // 12-16 sequential OpenAI calls would risk the function timeout) and
    // build a real .xlsx with each image embedded next to its post. Same
    // best-effort pattern: an individual post's image failing just leaves
    // that row without an image, and a total failure here doesn't touch
    // the text generation, which already succeeded.
    if (template.supportsCalendarFile) {
      try {
        const calendar = parseCalendarJson(content);

        const imageBuffers = await Promise.all(
          calendar.posts.map(async (post) => {
            try {
              const prompt = buildCalendarPostImagePrompt(
                post.copy,
                post.imageBrief,
                post.platform,
                onboarding.answers
              );
              const [base64Image] = await generateImages(prompt, 1, "1024x1024");
              return Buffer.from(base64Image, "base64");
            } catch {
              return null;
            }
          })
        );

        const xlsxBuffer = await buildCalendarXlsx(calendar.posts, imageBuffers);
        const storagePath = `${projectId}/${template.id}/${crypto.randomUUID()}.xlsx`;

        const { error: uploadError } = await supabase.storage
          .from("asset-documents")
          .upload(storagePath, xlsxBuffer, {
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });

        if (!uploadError) {
          await supabase.from("asset_files").insert({
            generated_asset_id: assetRow.id,
            format: "xlsx",
            storage_path: storagePath,
          });
        }
      } catch {
        // Swallow — text (JSON) generation already succeeded; a failed
        // xlsx build just means no download file yet.
      }
    }

    return NextResponse.json({ success: true, assetId: assetRow.id, content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await supabase
      .from("generated_assets")
      .update({ status: "failed", error: message })
      .eq("id", assetRow.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
