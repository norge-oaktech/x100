import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { NewProjectForm } from "./NewProjectForm";
import type { Project, Client } from "@/types/database";

const STATUS_LABEL: Record<string, string> = {
  awaiting_onboarding: "Awaiting onboarding",
  onboarding_in_progress: "Onboarding in progress",
  onboarding_complete: "Onboarding complete — ready for generation",
  generating: "Generating",
  ready: "Ready",
  archived: "Archived",
};

const STATUS_COLOR: Record<string, string> = {
  awaiting_onboarding: "bg-slate-100 text-slate-700",
  onboarding_in_progress: "bg-amber-100 text-amber-800",
  onboarding_complete: "bg-blue-100 text-blue-800",
  generating: "bg-purple-100 text-purple-800",
  ready: "bg-green-100 text-green-800",
  archived: "bg-slate-100 text-slate-500",
};

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, slug, status, created_at, client_id, clients(name)")
    .order("created_at", { ascending: false })
    .returns<(Project & { clients: Pick<Client, "name"> | null })[]>();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-medium">Projects</h1>
        <form action="/auth/signout" method="post">
          <button className="text-xs text-slate-500 hover:text-slate-800">
            Sign out
          </button>
        </form>
      </div>

      <div className="mt-6">
        <NewProjectForm />
      </div>

      <div className="mt-8 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {!projects || projects.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">
            No projects yet — create one above.
          </p>
        ) : (
          projects.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/${p.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium">
                  {p.clients?.name ?? "Unnamed client"}
                </p>
                <p className="text-xs text-slate-500">
                  Created {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_COLOR[p.status]
                }`}
              >
                {STATUS_LABEL[p.status]}
              </span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
