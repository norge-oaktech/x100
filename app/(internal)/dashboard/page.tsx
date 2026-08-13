import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { NewProjectForm } from "./NewProjectForm";
import type { Project, Client } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  awaiting_onboarding: "Awaiting onboarding",
  onboarding_in_progress: "Onboarding in progress",
  onboarding_complete: "Ready for generation",
  generating: "Generating",
  ready: "Ready",
  archived: "Archived",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  awaiting_onboarding: "b-draft",
  onboarding_in_progress: "b-onboarding",
  onboarding_complete: "b-onboard",
  generating: "b-generating",
  ready: "b-active",
  archived: "b-draft",
};

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, slug, status, created_at, client_id, clients(name)")
    .order("created_at", { ascending: false })
    .returns<(Project & { clients: Pick<Client, "name"> | null })[]>();

  const activeCount =
    projects?.filter((p) => p.status !== "archived").length ?? 0;
  const readyForGenCount =
    projects?.filter((p) => p.status === "onboarding_complete").length ?? 0;

  return (
    <main className="scroll mx-auto max-w-4xl">
      <div className="fb">
        <div>
          <div className="page-title">Projects</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button className="btn btn-ghost btn-sm">Sign out</button>
        </form>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          margin: "24px 0",
        }}
      >
        <div className="stat-card">
          <div className="stat-lbl">Active projects</div>
          <div className="stat-val">{activeCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Ready for generation</div>
          <div className="stat-val">{readyForGenCount}</div>
        </div>
      </div>

      <div className="mb20">
        <div className="section-label">New project</div>
        <NewProjectForm />
      </div>

      <div className="section-label">All projects</div>
      <div className="table-wrap">
        {!projects || projects.length === 0 ? (
          <div className="tm" style={{ padding: 20, fontSize: 13 }}>
            No projects yet — create one above.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Created</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/dashboard/${p.id}`}
                      className="tc"
                      style={{ display: "block" }}
                    >
                      {p.clients?.name ?? "Unnamed client"}
                    </Link>
                  </td>
                  <td className="tm">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        STATUS_BADGE_CLASS[p.status] ?? "b-draft"
                      }`}
                    >
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
