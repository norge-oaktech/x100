import { ASSET_TEMPLATES } from "@/config/assets";
import { generateAssetContent, ANTHROPIC_MODEL } from "@/lib/anthropic/generate";
import { generatePerplexityContent, PERPLEXITY_MODEL } from "@/lib/perplexity/generate";
import { resolveSystemPrompt } from "@/lib/assets/resolvePrompt";
import { buildStyledDocx } from "@/lib/docx/buildStyledDocx";
import type { SupabaseClient } from "@supabase/supabase-js";

type OnboardingAnswers = Record<string, string | string[]>;

// Runs every foundational asset for a given stage in parallel and writes
// each result as its own generated_assets row. Stage 1 (ICP, Brand
// Identity) is what onboarding submission triggers automatically; Stage 2
// (Brand Guidelines, Messaging Framework) only ever gets triggered once
// Stage 1 is fully approved (see the auto-trigger in
// app/api/assets/review/route.ts, and the manual "Generate Stage N" button
// in app/api/generate-foundational/route.ts). Accepts whatever Supabase
// client the caller already has -- the admin (service-role) client from the
// public onboarding action, or the session-aware client from an
// authenticated team route -- since both satisfy the same insert/update
// shape against this table.
export async function generateFoundationalBatch(
  supabase: SupabaseClient,
  projectId: string,
  answers: OnboardingAnswers,
  clientId: string | null = null,
  stage: 1 | 2 = 1
) {
  const foundationalTemplates = ASSET_TEMPLATES.filter(
    (t) => t.tier === "foundational" && t.foundationalStage === stage
  );

  const results = await Promise.allSettled(
    foundationalTemplates.map(async (template) => {
      const userPrompt = template.buildUserPrompt(answers);
      const systemPrompt = await resolveSystemPrompt(supabase, template.id, clientId);

      const { data: assetRow, error: insertError } = await supabase
        .from("generated_assets")
        .insert({
          project_id: projectId,
          asset_key: template.id,
          status: "generating",
          prompt_snapshot: userPrompt,
          approval_status: "pending",
        })
        .select("id")
        .single();

      if (insertError || !assetRow) {
        throw new Error(insertError?.message ?? "Could not create asset row");
      }

      try {
        const generate =
          template.provider === "perplexity" ? generatePerplexityContent : generateAssetContent;
        const modelUsed = template.provider === "perplexity" ? PERPLEXITY_MODEL : ANTHROPIC_MODEL;

        const content = await generate(systemPrompt, userPrompt, template.maxTokens ?? 4000);

        await supabase
          .from("generated_assets")
          .update({
            status: "complete",
            content,
            model_used: modelUsed,
            generated_at: new Date().toISOString(),
          })
          .eq("id", assetRow.id);

        // Same best-effort docx-build step as app/api/generate/route.ts --
        // duplicated here (not shared as a single call site) because this
        // batch pipeline is the one that actually runs for ICP on its
        // first-ever generation (onboarding submission / "Generate Stage 1"),
        // not the individual-asset route. A failure here never touches the
        // text generation above, which already succeeded.
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
          }
        }

        return { assetKey: template.id, success: true as const };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
        await supabase
          .from("generated_assets")
          .update({ status: "failed", error: message })
          .eq("id", assetRow.id);
        throw err;
      }
    })
  );

  return results.map((r, i) => ({
    assetKey: foundationalTemplates[i].id,
    ok: r.status === "fulfilled",
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));
}
