import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetTemplate, allFoundationalApproved } from "@/config/assets";
import { generateAssetContent, ANTHROPIC_MODEL } from "@/lib/anthropic/generate";
import { generateImages } from "@/lib/openai/generateImage";
import { buildDefaultImagePrompt } from "@/lib/assets/buildImagePrompt";
import { parseDeckJson, buildDeckPptx } from "@/lib/decks/buildPptx";
import type { GeneratedAsset } from "@/types/database";

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
            "This asset is locked until all 6 foundational documents (ICP, Brand Identity, Brand Guidelines, Messaging Framework, Case Studies, DDQ) are approved.",
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
    let content = await generateAssetContent(
      template.systemPrompt,
      userPrompt,
      template.maxTokens
    );

    // Safety net for HTML assets: Claude sometimes wraps code in a markdown
    // fence despite explicit instructions not to. A stray ```html at the
    // top would break a direct paste into GHL's Custom HTML element, so
    // strip a leading/trailing fence if present.
    if (template.outputFormat === "html") {
      content = content
        .trim()
        .replace(/^```(?:html)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
    }

    await supabase
      .from("generated_assets")
      .update({
        status: "complete",
        content,
        model_used: ANTHROPIC_MODEL,
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

    // For deck-file assets, build the actual .pptx from the structured JSON
    // Claude just generated. Best-effort, same pattern as images: a failure
    // here does not fail the text generation, which already succeeded and
    // is what the approval/review flow actually reads.
    if (template.supportsDeckFile) {
      try {
        const deck = parseDeckJson(content);
        const pptxBuffer = await buildDeckPptx(deck);
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
        // Swallow — text (JSON) generation already succeeded; a failed
        // pptx build just means no download file yet. Most likely cause is
        // Claude's JSON not parsing cleanly — Regenerate will retry both.
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
