import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFoundationalBatch } from "@/lib/assets/generateFoundational";

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { projectId } = await request.json();

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  const { data: onboarding } = await supabase
    .from("onboarding_responses")
    .select("answers")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!onboarding || !onboarding.answers) {
    return NextResponse.json(
      { error: "No onboarding answers found for this project" },
      { status: 400 }
    );
  }

  const results = await generateFoundationalBatch(supabase, projectId, onboarding.answers);

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `${failures.length} of ${results.length} foundational documents failed to generate.`,
        results,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ success: true, results });
}
