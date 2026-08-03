"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { ONBOARDING_SECTIONS, getSectionById } from "@/config/onboardingSchema";

const ELIGIBLE_STATUSES = [
  "awaiting_onboarding",
  "onboarding_in_progress",
];

async function getEligibleProjectBySlug(slug: string) {
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, status")
    .eq("slug", slug)
    .single();

  if (!project) return { error: "Not found" as const };
  if (!ELIGIBLE_STATUSES.includes(project.status)) {
    return { error: "Not eligible" as const };
  }
  return { project };
}

export async function saveSectionAction(
  slug: string,
  sectionId: string,
  answers: Record<string, string | string[]>
) {
  const section = getSectionById(sectionId);
  if (!section) return { error: "Unknown section" };

  const lookup = await getEligibleProjectBySlug(slug);
  if ("error" in lookup) return { error: lookup.error };
  const { project } = lookup;

  const supabase = createAdminClient();

  // Only keep answers for fields that actually belong to this section —
  // never trust the client to scope its own writes.
  const allowedFieldIds = new Set(section.fields.map((f) => f.id));
  const scopedAnswers = Object.fromEntries(
    Object.entries(answers).filter(([key]) => allowedFieldIds.has(key))
  );

  const { data: existing } = await supabase
    .from("onboarding_responses")
    .select("answers, completed_sections")
    .eq("project_id", project.id)
    .maybeSingle();

  const mergedAnswers = { ...(existing?.answers ?? {}), ...scopedAnswers };
  const completedSections = new Set(existing?.completed_sections ?? []);
  completedSections.add(sectionId);

  if (existing) {
    await supabase
      .from("onboarding_responses")
      .update({
        answers: mergedAnswers,
        completed_sections: Array.from(completedSections),
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", project.id);
  } else {
    await supabase.from("onboarding_responses").insert({
      project_id: project.id,
      answers: mergedAnswers,
      completed_sections: Array.from(completedSections),
    });
  }

  await supabase
    .from("projects")
    .update({ status: "onboarding_in_progress", updated_at: new Date().toISOString() })
    .eq("id", project.id)
    .eq("status", "awaiting_onboarding");

  return { success: true };
}

export async function completeOnboardingAction(slug: string) {
  const lookup = await getEligibleProjectBySlug(slug);
  if ("error" in lookup) return { error: lookup.error };
  const { project } = lookup;

  const supabase = createAdminClient();

  const { data: response } = await supabase
    .from("onboarding_responses")
    .select("completed_sections")
    .eq("project_id", project.id)
    .maybeSingle();

  const completed = new Set(response?.completed_sections ?? []);
  const allSectionIds = ONBOARDING_SECTIONS.map((s) => s.id);
  const missing = allSectionIds.filter((id) => !completed.has(id));

  if (missing.length > 0) {
    return { error: "Incomplete", missing };
  }

  await supabase
    .from("onboarding_responses")
    .update({ submitted_at: new Date().toISOString() })
    .eq("project_id", project.id);

  await supabase
    .from("projects")
    .update({
      status: "onboarding_complete",
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id);

  return { success: true };
}
