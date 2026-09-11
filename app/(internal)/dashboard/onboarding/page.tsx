import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ONBOARDING_SECTIONS } from "@/config/onboardingSchema";
import { UploadAnswersButton } from "./UploadAnswersButton";
import { DownloadQuestionsButton } from "./DownloadQuestionsButton";
import type { Project, Client, OnboardingResponse } from "@/types/database";

const STATUS_BADGE_CLASS: Record<string, string> = {
  awaiting_onboarding: "b-draft",
  onboarding_in_progress: "b-onboarding",
  onboarding_complete: "b-onboard",
  generating: "b-generating",
  ready: "b-active",
  archived: "b-draft",
};

// Same definition used on the project detail page: onboarding is only
// "done" once status has moved past these two.
function isOnboardingIncomplete(status: string): boolean {
  return status === "awaiting_onboarding" || status === "onboarding_in_progress";
}

export default async function OnboardingOverviewPage() {
  const supabase = createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, slug, status, created_at, clients(name)")
    .order("created_at", { ascending: false })
    .returns<
      (Pick<Project, "id" | "slug" | "status" | "created_at"> & {
        clients: Pick<Client, "name"> | null;
      })[]
    >();

  const { data: responses } = await supabase
    .from("onboarding_responses")
    .select("project_id, completed_sections, submitted_at")
    .returns<Pick<OnboardingResponse, "project_id" | "completed_sections" | "submitted_at">[]>();

  const responseByProject = new Map(
    (responses ?? []).map((r) => [r.project_id, r])
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <main className="scroll mx-auto max-w-4xl">
      <div className="page-title">Onboarding</div>
      <div className="page-sub">
        Upload a client&apos;s completed questionnaire directly — no need to
        go through Clients or Assets first
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
            const response = responseByProject.get(p.id);
            const completedCount = response?.completed_sections?.length ?? 0;
            const totalSections = ONBOARDING_SECTIONS.length;
            const incomplete = isOnboardingIncomplete(p.status);

            return (
              <div key={p.id} className="card-sm">
                <div className="fb">
                  <div>
                    <div className="fac gap8">
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {p.clients?.name ?? "Unnamed client"}
                      </span>
                      <span className={`badge ${STATUS_BADGE_CLASS[p.status] ?? "b-draft"}`}>
                        {p.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="tf" style={{ fontSize: 11, marginTop: 2 }}>
                      {completedCount}/{totalSections} sections
                      {response?.submitted_at &&
                        ` · submitted ${new Date(response.submitted_at).toLocaleDateString()}`}
                    </div>
                    {incomplete && (
                      <code
                        className="tm"
                        style={{
                          display: "block",
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          marginTop: 6,
                        }}
                      >
                        {appUrl}/onboard/{p.slug}
                      </code>
                    )}
                  </div>
                  <div className="fac gap8" style={{ alignItems: "flex-start" }}>
                    <DownloadQuestionsButton />
                    <UploadAnswersButton projectId={p.id} />
                    <Link href={`/dashboard/${p.id}`} className="btn btn-ghost btn-xs">
                      Open project
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
