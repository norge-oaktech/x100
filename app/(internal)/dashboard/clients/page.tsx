import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Client, Project } from "@/types/database";

export default async function ClientsPage() {
  const supabase = createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Client[]>();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, client_id, status")
    .returns<Pick<Project, "id" | "client_id" | "status">[]>();

  const projectCountByClient = new Map<string, number>();
  for (const p of projects ?? []) {
    projectCountByClient.set(p.client_id, (projectCountByClient.get(p.client_id) ?? 0) + 1);
  }

  return (
    <main className="scroll mx-auto max-w-4xl">
      <div className="page-title">Clients</div>
      <div className="page-sub">
        {clients?.length ?? 0} client{clients?.length === 1 ? "" : "s"}
      </div>

      <div className="table-wrap">
        {!clients || clients.length === 0 ? (
          <div className="tm" style={{ padding: 20, fontSize: 13 }}>
            No clients yet — clients are created automatically when you
            start a new project from the{" "}
            <Link href="/dashboard" className="tc">
              Dashboard
            </Link>
            .
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Projects</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/dashboard/clients/${c.id}`} className="tc" style={{ display: "block" }}>
                      {c.name}
                    </Link>
                  </td>
                  <td className="tm">{projectCountByClient.get(c.id) ?? 0}</td>
                  <td className="tm">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
