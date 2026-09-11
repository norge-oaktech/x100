"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { ONBOARDING_SECTIONS, getSectionById } from "@/config/onboardingSchema";
import { generateFoundationalBatch } from "@/lib/assets/generateFoundational";
import { extractAnswersFromUploadedText } from "@/lib/onboarding/parseUploadedAnswers";

const ELIGIBLE_STATUSES = [
  "awaiting_onboarding",
  "onboarding_in_progress",
];

async function getEligibleProjectBySlug(slug: string) {
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, status, client_id")
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
    .select("answers, completed_sections")
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

  // Guarded update: only succeeds if the project is still in an onboarding
  // status. This is what prevents a resubmit (or a duplicate request) from
  // triggering the foundational batch a second time -- if the row was
  // already flipped to onboarding_complete by an earlier call, this update
  // affects zero rows and we skip generation below.
  const { data: updatedProject } = await supabase
    .from("projects")
    .update({
      status: "onboarding_complete",
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id)
    .in("status", ["awaiting_onboarding", "onboarding_in_progress"])
    .select("id")
    .maybeSingle();

  if (updatedProject && response?.answers) {
    // Auto-generate Stage 1 of the foundational documents (ICP, Brand
    // Identity) now that onboarding is complete. Stage 2 (Brand Guidelines,
    // Messaging Framework) only generates once Stage 1 is fully approved --
    // see the auto-trigger in app/api/assets/review/route.ts. Awaited
    // deliberately (not fire-and-forget) so a serverless function teardown
    // can't kill it mid-generation -- the client's "Submit" button shows a
    // loading state for the duration.
    await generateFoundationalBatch(
      supabase,
      project.id,
      response.answers,
      project.client_id ?? null,
      1
    );

    await supabase
      .from("projects")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", project.id);
  }

  return { success: true };
}

// Lets a client skip the step-by-step wizard by uploading a questionnaire
// they (or their own AI assistant) already answered offline. Deliberately
// does NOT auto-submit or trigger foundational generation -- AI extraction
// can miss or misread things, so this only prefills the wizard's draft
// answers and marks a section "complete" once every field in it got a
// match. The client still reviews each section in the normal wizard UI and
// clicks Submit themselves, exactly like the manual flow -- this just
// saves them re-typing everything.
export async function parseUploadedQuestionnaireAction(
  slug: string,
  rawText: string
) {
  if (!rawText || rawText.trim().length === 0) {
    return { error: "The uploaded file appears to be empty" };
  }

  const lookup = await getEligibleProjectBySlug(slug);
  if ("error" in lookup) return { error: lookup.error };
  const { project } = lookup;

  let extracted;
  try {
    extracted = await extractAnswersFromUploadedText(rawText);
  } catch (err) {
    return {
      error:
        "Could not read answers from that file — try again, or fill out the form directly below.",
    };
  }

  if (extracted.matchedFieldCount === 0) {
    return {
      error:
        "Didn't find any recognizable answers in that file — make sure it's the completed questionnaire text, then try again.",
    };
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("onboarding_responses")
    .select("answers, completed_sections")
    .eq("project_id", project.id)
    .maybeSingle();

  const mergedAnswers = { ...(existing?.answers ?? {}), ...extracted.answers };

  // A section only counts as "complete" (pre-checked, wizard resumes past
  // it) once every one of its fields has an answer in the merged set --
  // partial matches still save, they just leave that section open for the
  // client to fill the gaps in manually.
  const completedSections = new Set<string>(existing?.completed_sections ?? []);
  for (const section of ONBOARDING_SECTIONS) {
    const allAnswered = section.fields.every(
      (f) => mergedAnswers[f.id] !== undefined
    );
    if (allAnswered) completedSections.add(section.id);
  }

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

  return {
    success: true as const,
    answers: mergedAnswers,
    completedSections: Array.from(completedSections) as string[],
    matchedFieldCount: extracted.matchedFieldCount,
    totalFieldCount: extracted.totalFieldCount,
  };
}
