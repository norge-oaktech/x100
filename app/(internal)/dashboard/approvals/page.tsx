import { createClient } from "@/lib/supabase/server";
import { getAssetTemplate } from "@/config/assets";
import { ApprovalsList, type PendingApprovalItem } from "./ApprovalsList";
import type { Client, Project } from "@/types/database";

export default async function ApprovalsPage() {
  const supabase = createClient();

  const { data: pending } = await supabase
    .from("generated_assets")
    .select("id, asset_key, content, created_at, project_id, projects(id, clients(name))")
    .eq("approval_status", "pending")
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .returns<
      {
        id: string;
        asset_key: string;
        content: string | null;
        created_at: string;
        project_id: string;
        projects: (Pick<Project, "id"> & { clients: Pick<Client, "name"> | null }) | null;
      }[]
    >();

  const items: PendingApprovalItem[] = (pending ?? []).map((row) => ({
    id: row.id,
    assetLabel: getAssetTemplate(row.asset_key)?.label ?? row.asset_key,
    content: row.content ?? "",
    createdAt: row.created_at,
    projectId: row.project_id,
    clientName: row.projects?.clients?.name ?? "Unknown client",
  }));

  return (
    <main className="scroll mx-auto max-w-4xl">
      <div className="page-title">Approvals</div>
      <div className="page-sub">
        {items.length} item{items.length === 1 ? "" : "s"} waiting on review, across all projects
      </div>

      <ApprovalsList items={items} />
    </main>
  );
}
