import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DeleteClientButton } from "../../DeleteClientButton";
import type { Client, Project } from "@/types/database";

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

export default async function ClientDetailPage({
  params,
}: {
  params: { clientId: string };
}) {
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.clientId)
    .maybeSingle<Client>();

  if (!client) notFound();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false })
    .returns<Project[]>();

  return (
    <main className="scroll mx-auto max-w-4xl">
      <div className="breadcrumb mb8">
        <Link href="/dashboard/clients" className="crumb-link">
          Clients
        </Link>
        <span className="sep">/</span>
        <span className="current">{client.name}</span>
      </div>

      <div className="fb">
        <div>
          <div className="page-title" style={{ marginBottom: 0 }}>{client.name}</div>
          <div className="page-sub">
            Client since {new Date(client.created_at).toLocaleDateString()}
          </div>
        </div>
        <DeleteClientButton
          clientId={client.id}
          clientName={client.name}
          projectCount={projects?.length ?? 0}
          redirectTo="/dashboard/clients"
          className="btn btn-danger btn-sm"
        />
      </div>

      <div className="section-label">Projects</div>
      <div className="table-wrap">
        {!projects || projects.length === 0 ? (
          <div className="tm" style={{ padding: 20, fontSize: 13 }}>
            No projects for this client yet.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/dashboard/${p.id}`} className="tc" style={{ display: "block" }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE_CLASS[p.status] ?? "b-draft"}`}>
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
