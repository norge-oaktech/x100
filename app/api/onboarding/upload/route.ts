import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_SECTIONS } from "@/config/onboardingSchema";
import { extractAnswersFromUploadedText } from "@/lib/onboarding/parseUploadedAnswers";

// Staff-facing counterpart to parseUploadedQuestionnaireAction (the public
// onboarding page's upload handler). Same extraction pipeline, but this
// one requires an authenticated team member instead of matching a public
// project slug, and has no project-status restriction -- staff should be
// able to upload/update a client's answers on any project, not just ones
// still "awaiting" or "in progress" onboarding.
//
// Same safety principle as the public flow: this only prefills the
// project's draft answers and marks a section complete once every field in
// it has a match. It never auto-triggers foundational generation -- staff
// review the merged answers on the project's Onboarding Answers tab and
// use the existing "Generate Stage 1" button when ready, exactly like a
// project the client filled out themselves.
export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { projectId, text } = (await request.json()) as {
    projectId?: string;
    text?: string;
  };

  if (!projectId || !text || text.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing projectId or text" },
      { status: 400 }
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let extracted;
  try {
    extracted = await extractAnswersFromUploadedText(text);
  } catch {
    return NextResponse.json(
      { error: "Could not read answers from that file — check the format and try again." },
      { status: 400 }
    );
  }

  if (extracted.matchedFieldCount === 0) {
    return NextResponse.json(
      { error: "Didn't find any recognizable answers in that file." },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("onboarding_responses")
    .select("answers, completed_sections")
    .eq("project_id", projectId)
    .maybeSingle();

  const mergedAnswers = { ...(existing?.answers ?? {}), ...extracted.answers };

  const completedSections = new Set<string>(existing?.completed_sections ?? []);
  for (const section of ONBOARDING_SECTIONS) {
    const allAnswered = section.fields.every((f) => mergedAnswers[f.id] !== undefined);
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
      .eq("project_id", projectId);
  } else {
    await supabase.from("onboarding_responses").insert({
      project_id: projectId,
      answers: mergedAnswers,
      completed_sections: Array.from(completedSections),
    });
  }

  // Only advance status forward from "awaiting" -- a project already
  // further along (in progress, complete, generating) shouldn't get
  // bumped backward or interrupted by a staff-side answer update.
  await supabase
    .from("projects")
    .update({ status: "onboarding_in_progress", updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("status", "awaiting_onboarding");

  return NextResponse.json({
    success: true,
    matchedFieldCount: extracted.matchedFieldCount,
    totalFieldCount: extracted.totalFieldCount,
    completedSectionCount: completedSections.size,
    totalSectionCount: ONBOARDING_SECTIONS.length,
  });
}
