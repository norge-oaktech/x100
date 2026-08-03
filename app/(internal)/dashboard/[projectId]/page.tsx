import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_SECTIONS } from "@/config/onboardingSchema";
import { notFound } from "next/navigation";
import type { OnboardingResponse, Project, Client } from "@/types/database";

export default async function ProjectDetailPage({
  params,
}: {
  params: { projectId: string };
}) {
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(name)")
    .eq("id", params.projectId)
    .single<Project & { clients: Pick<Client, "name"> | null }>();

  if (!project) notFound();

  const { data: response } = await supabase
    .from("onboarding_responses")
    .select("*")
    .eq("project_id", project.id)
    .maybeSingle<OnboardingResponse>();

  const onboardingUrl = `${
    process.env.NEXT_PUBLIC_APP_URL ?? ""
  }/onboard/${project.slug}`;

  const completedCount = response?.completed_sections?.length ?? 0;

  return (
    <main className="mx-auto max-w-3xl p-8">
      <a href="/dashboard" className="text-xs text-slate-500 hover:underline">
        ← Projects
      </a>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-lg font-medium">
          {project.clients?.name ?? "Unnamed client"}
        </h1>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {project.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500">Onboarding link</p>
        <code className="text-xs">{onboardingUrl}</code>
        <p className="mt-3 text-xs text-slate-500">
          Progress: {completedCount} / {ONBOARDING_SECTIONS.length} sections
          completed
          {response?.submitted_at &&
            ` — submitted ${new Date(
              response.submitted_at
            ).toLocaleDateString()}`}
        </p>
      </div>

      {!response ? (
        <p className="mt-8 text-sm text-slate-500">
          Client hasn&apos;t started onboarding yet.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {ONBOARDING_SECTIONS.map((section) => {
            const isDone = response.completed_sections?.includes(section.id);
            return (
              <div
                key={section.id}
                className="rounded-lg border border-slate-200 bg-white p-5"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium">{section.title}</h2>
                  <span
                    className={`text-xs ${
                      isDone ? "text-green-700" : "text-slate-400"
                    }`}
                  >
                    {isDone ? "Complete" : "Not started"}
                  </span>
                </div>
                {isDone && (
                  <dl className="mt-3 space-y-3">
                    {section.fields.map((field) => {
                      const value = response.answers?.[field.id];
                      if (!value || (Array.isArray(value) && value.length === 0))
                        return null;
                      return (
                        <div key={field.id}>
                          <dt className="text-xs font-medium text-slate-500">
                            {field.label}
                          </dt>
                          <dd className="text-sm text-slate-800">
                            {Array.isArray(value) ? value.join(", ") : value}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
