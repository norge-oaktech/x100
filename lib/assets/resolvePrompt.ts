import type { SupabaseClient } from "@supabase/supabase-js";
import { getAssetTemplate, KB_GUARDRAILS } from "@/config/assets";

// Resolution order: client-specific override, then general override, then
// the hardcoded default from config/assets.ts. Custom overrides (from the
// Prompt Library) always get KB_GUARDRAILS appended at use time -- the
// override text itself only needs the asset-specific instructions, not
// repeat the anti-fabrication rules, and this means an override can't
// accidentally (or deliberately) drop those rules.
export async function resolveSystemPrompt(
  supabase: SupabaseClient,
  assetKey: string,
  clientId: string | null
): Promise<string> {
  if (clientId) {
    const { data: clientOverride } = await supabase
      .from("prompt_overrides")
      .select("system_prompt")
      .eq("asset_key", assetKey)
      .eq("client_id", clientId)
      .maybeSingle();
    if (clientOverride?.system_prompt) {
      return clientOverride.system_prompt + KB_GUARDRAILS;
    }
  }

  const { data: generalOverride } = await supabase
    .from("prompt_overrides")
    .select("system_prompt")
    .eq("asset_key", assetKey)
    .is("client_id", null)
    .maybeSingle();
  if (generalOverride?.system_prompt) {
    return generalOverride.system_prompt + KB_GUARDRAILS;
  }

  const template = getAssetTemplate(assetKey);
  return template?.systemPrompt ?? "";
}
