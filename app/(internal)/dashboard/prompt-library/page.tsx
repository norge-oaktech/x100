import { createClient } from "@/lib/supabase/server";
import { ASSET_TEMPLATES } from "@/config/assets";
import {
  PromptLibraryList,
  type PromptLibraryAsset,
  type OverrideInfo,
} from "./PromptLibraryList";
import type { Client } from "@/types/database";

export default async function PromptLibraryPage({
  searchParams,
}: {
  searchParams: { client?: string };
}) {
  const supabase = createClient();
  const selectedClientId = searchParams.client ?? null;

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name", { ascending: true })
    .returns<Pick<Client, "id" | "name">[]>();

  const { data: generalRows } = await supabase
    .from("prompt_overrides")
    .select("asset_key, system_prompt, updated_by, updated_at")
    .is("client_id", null);

  const generalOverrides: Record<string, OverrideInfo> = {};
  for (const row of generalRows ?? []) {
    generalOverrides[row.asset_key] = {
      systemPrompt: row.system_prompt,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    };
  }

  let clientOverrides: Record<string, OverrideInfo> = {};
  if (selectedClientId) {
    const { data: clientRows } = await supabase
      .from("prompt_overrides")
      .select("asset_key, system_prompt, updated_by, updated_at")
      .eq("client_id", selectedClientId);

    for (const row of clientRows ?? []) {
      clientOverrides[row.asset_key] = {
        systemPrompt: row.system_prompt,
        updatedBy: row.updated_by,
        updatedAt: row.updated_at,
      };
    }
  }

  const assets: PromptLibraryAsset[] = ASSET_TEMPLATES.map((t) => ({
    id: t.id,
    label: t.label,
    category: t.category,
    phase: t.phase,
    tier: t.tier,
    defaultSystemPrompt: t.systemPrompt,
  }));

  return (
    <main className="scroll mx-auto max-w-5xl">
      <div className="page-title">Prompt Library</div>
      <div className="page-sub">
        {assets.length} asset prompts · edit here instead of code + redeploy
      </div>

      <PromptLibraryList
        assets={assets}
        clients={clients ?? []}
        selectedClientId={selectedClientId}
        generalOverrides={generalOverrides}
        clientOverrides={clientOverrides}
      />
    </main>
  );
}
