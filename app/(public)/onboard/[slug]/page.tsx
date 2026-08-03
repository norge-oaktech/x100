import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingWizard } from "./OnboardingWizard";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OnboardPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, status")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!project) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <p className="text-sm text-slate-600">
          This link isn&apos;t valid. Please check the link you were sent, or
          contact us for a new one.
        </p>
      </main>
    );
  }

  if (project.status === "onboarding_complete" || project.status === "generating" || project.status === "ready") {
    redirect(`/onboard/${params.slug}/complete`);
  }

  const { data: response } = await supabase
    .from("onboarding_responses")
    .select("answers, completed_sections")
    .eq("project_id", project.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-white">
      <OnboardingWizard
        slug={params.slug}
        initialAnswers={response?.answers ?? {}}
        initialCompletedSections={response?.completed_sections ?? []}
      />
    </main>
  );
}
