import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ONBOARDING_SECTIONS } from "@/config/onboardingSchema";
import { applyCompanyFormAliases } from "@/config/formAliases";

// Public-facing (no user session -- this is called BY Dorine's platform,
// not by someone signed into x100), so authenticated a different way: a
// shared secret in a header, checked against ONBOARDING_WEBHOOK_SECRET.
// Set that env var to a long random value in Vercel and give the same
// value to Dorine to configure on her side -- whoever doesn't have it
// can't post into this endpoint.
function isAuthorized(req: Request): boolean {
  const expected = process.env.ONBOARDING_WEBHOOK_SECRET;
  if (!expected) return false; // fail closed if the secret was never configured
  const provided = req.headers.get("x-webhook-secret");
  return provided === expected;
}

// Validates that every key in the incoming (already alias-translated)
// answers object is a real onboardingSchema field id -- never trust an
// external system to only send known keys. Unknown keys are dropped, not
// silently ignored: logged so an unmapped field from Dorine's form is
// visible in Vercel's logs rather than just vanishing.
function filterToKnownFields(
  raw: Record<string, unknown>
): { answers: Record<string, string | string[]>; droppedKeys: string[] } {
  const validIds = new Set<string>();
  for (const section of ONBOARDING_SECTIONS) {
    for (const field of section.fields) validIds.add(field.id);
  }

  const answers: Record<string, string | string[]> = {};
  const droppedKeys: string[] = [];

  for (const [key, value] of Object.entries(raw)) {
    if (!validIds.has(key)) {
      droppedKeys.push(key);
      continue;
    }
    if (typeof value === "string" && value.trim() !== "") {
      answers[key] = value;
    } else if (
      Array.isArray(value) &&
      value.every((v) => typeof v === "string") &&
      value.length > 0
    ) {
      answers[key] = value as string[];
    } else {
      droppedKeys.push(key);
    }
  }

  return { answers, droppedKeys };
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { slug?: string; answers?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug, answers: rawAnswers } = body;

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }
  if (!rawAnswers || typeof rawAnswers !== "object") {
    return NextResponse.json({ error: "Missing answers object" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!project) {
    return NextResponse.json(
      { error: `No project found for slug "${slug}"` },
      { status: 404 }
    );
  }

  // Step 1: translate Dorine's known short keys (carry, mgmt_fee, etc.) to
  // this app's real field ids. Anything not in the alias map — including
  // this app's own field ids, if she ever sends those directly — passes
  // through unchanged and gets checked against the real schema next.
  const aliased = applyCompanyFormAliases(rawAnswers as Record<string, string | string[]>);

  // Step 2: drop anything that still isn't a recognized field id, logging
  // what got dropped so an unmapped key from her form doesn't just vanish
  // without a trace -- extend config/formAliases.ts's COMPANY_FORM_ALIASES
  // once a genuinely new one shows up here repeatedly.
  const { answers: newAnswers, droppedKeys } = filterToKnownFields(aliased);

  if (droppedKeys.length > 0) {
    console.warn(
      `Onboarding webhook for project ${project.id} (slug ${slug}): dropped ${droppedKeys.length} unrecognized key(s): ${droppedKeys.join(", ")}`
    );
  }

  if (Object.keys(newAnswers).length === 0) {
    return NextResponse.json(
      {
        error: "None of the submitted answers matched a known field.",
        droppedKeys,
      },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("onboarding_responses")
    .select("answers, completed_sections")
    .eq("project_id", project.id)
    .maybeSingle();

  const mergedAnswers = { ...(existing?.answers ?? {}), ...newAnswers };

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
      .eq("project_id", project.id);
  } else {
    await supabase.from("onboarding_responses").insert({
      project_id: project.id,
      answers: mergedAnswers,
      completed_sections: Array.from(completedSections),
    });
  }

  // Same as every other ingestion path in this app: prefill only, never
  // auto-trigger foundational generation. Staff review the merged answers
  // on the project's Onboarding Answers tab and click "Generate Stage 1"
  // themselves when ready — even though this webhook represents a real
  // external submission (not a manual staff upload), keeping one
  // consistent, reviewable trigger point is safer than three different
  // paths that each decide independently whether to kick off generation.
  if (project.status === "awaiting_onboarding") {
    await supabase
      .from("projects")
      .update({ status: "onboarding_in_progress", updated_at: new Date().toISOString() })
      .eq("id", project.id);
  }

  return NextResponse.json({
    success: true,
    matchedFieldCount: Object.keys(newAnswers).length,
    droppedKeyCount: droppedKeys.length,
    completedSectionCount: completedSections.size,
    totalSectionCount: ONBOARDING_SECTIONS.length,
  });
}
