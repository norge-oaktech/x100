import { ASSET_TEMPLATES } from "@/config/assets";
import { generateAssetContent, ANTHROPIC_MODEL } from "@/lib/anthropic/generate";
import type { SupabaseClient } from "@supabase/supabase-js";

type OnboardingAnswers = Record<string, string | string[]>;

// Runs every foundational asset in parallel and writes each result as its
// own generated_assets row. Accepts whatever Supabase client the caller
// already has -- the admin (service-role) client from the public onboarding
// action, or the session-aware client from an authenticated team route --
// since both satisfy the same insert/update shape against this table.
export async function generateFoundationalBatch(
  supabase: SupabaseClient,
  projectId: string,
  answers: OnboardingAnswers
) {
  const foundationalTemplates = ASSET_TEMPLATES.filter(
    (t) => t.tier === "foundational"
  );

  const results = await Promise.allSettled(
    foundationalTemplates.map(async (template) => {
      const userPrompt = template.buildUserPrompt(answers);

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
        const content = await generateAssetContent(
          template.systemPrompt,
          userPrompt,
          template.maxTokens
        );

        await supabase
          .from("generated_assets")
          .update({
            status: "complete",
            content,
            model_used: ANTHROPIC_MODEL,
            generated_at: new Date().toISOString(),
          })
          .eq("id", assetRow.id);

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
