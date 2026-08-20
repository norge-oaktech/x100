import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  ASSET_TEMPLATES,
  REQUIRED_FOUNDATIONAL_ASSET_IDS,
  getAssetTemplate,
} from "@/config/assets";
import { DeleteClientButton } from "../DeleteClientButton";
import type { Project, Client, GeneratedAsset } from "@/types/database";

const MARKETING_ASSET_COUNT = ASSET_TEMPLATES.filter((t) => t.tier === "marketing").length;

export default async function AssetsOverviewPage() {
  const supabase = createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, client_id, status, created_at, clients(name)")
    .order("created_at", { ascending: false })
    .returns<
      (Pick<Project, "id" | "client_id" | "status" | "created_at"> & {
        clients: Pick<Client, "name"> | null;
      })[]
    >();

  const projectCountByClient = new Map<string, number>();
  for (const p of projects ?? []) {
    projectCountByClient.set(p.client_id, (projectCountByClient.get(p.client_id) ?? 0) + 1);
  }

  const { data: allGenerated } = await supabase
    .from("generated_assets")
    .select("project_id, asset_key, approval_status")
    .returns<Pick<GeneratedAsset, "project_id" | "asset_key" | "approval_status">[]>();

  const generatedByProject = new Map<string, Pick<GeneratedAsset, "project_id" | "asset_key" | "approval_status">[]>();
  for (const row of allGenerated ?? []) {
    const list = generatedByProject.get(row.project_id) ?? [];
    list.push(row);
    generatedByProject.set(row.project_id, list);
  }

  return (
    <main className="scroll mx-auto max-w-4xl">
      <div className="page-title">Assets</div>
      <div className="page-sub">
        Where generation actually happens — pick a project to view or generate its documents
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {!projects || projects.length === 0 ? (
          <div className="card-sm">
            <p className="tm" style={{ fontSize: 13 }}>
              No projects yet.
            </p>
          </div>
        ) : (
          projects.map((p) => {
            const generated = generatedByProject.get(p.id) ?? [];
            const approvedIds = new Set(
              generated.filter((g) => g.approval_status === "approved").map((g) => g.asset_key)
            );
            const pendingRequired = REQUIRED_FOUNDATIONAL_ASSET_IDS.filter(
              (id) => !approvedIds.has(id)
            );
            const foundationalStarted = generated.length > 0;
            const marketingCount = generated.filter((g) => {
              const t = getAssetTemplate(g.asset_key);
              return t?.tier === "marketing";
            }).length;

            const isUnlocked = pendingRequired.length === 0;

            return (
              <div key={p.id} className="card-sm">
                <div className="fb">
                  <div>
                    <div className="fac gap8">
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {p.clients?.name ?? "Unnamed client"}
                      </span>
                      <DeleteClientButton
                        clientId={p.client_id}
                        clientName={p.clients?.name ?? "Unnamed client"}
                        projectCount={projectCountByClient.get(p.client_id) ?? 1}
                      />
                    </div>
                    <div className="tf" style={{ fontSize: 11, marginTop: 2 }}>
                      Created {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="fac gap8">
                    {isUnlocked ? (
                      <span className="badge b-active">
                        {marketingCount}/{MARKETING_ASSET_COUNT} marketing assets generated
                      </span>
                    ) : (
                      <span className="badge b-onboarding">Waiting on approval</span>
                    )}
                    <Link href={`/dashboard/${p.id}`} className="btn btn-primary btn-xs">
                      Open project
                    </Link>
                  </div>
                </div>

                {!isUnlocked && (
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    {!foundationalStarted ? (
                      <p className="tf" style={{ fontSize: 12 }}>
                        No foundational documents generated yet.
                      </p>
                    ) : (
                      <>
                        <p className="tf" style={{ fontSize: 12, marginBottom: 6 }}>
                          Waiting for approval of the following documents before
                          marketing assets can be generated:
                        </p>
                        <ul style={{ paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)" }}>
                          {pendingRequired.map((id) => {
                            const template = getAssetTemplate(id);
                            const row = generated.find((g) => g.asset_key === id);
                            const state = !row
                              ? "not generated yet"
                              : row.approval_status === "pending"
                              ? "generated, pending review"
                              : row.approval_status === "rejected"
                              ? "rejected — needs regeneration"
                              : "not generated yet";
                            return (
                              <li key={id}>
                                {template?.label ?? id} — {state}
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
