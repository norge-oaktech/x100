import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateFoundationalBatch } from "@/lib/assets/generateFoundational";
import { stage1FoundationalApproved } from "@/config/assets";
import type { GeneratedAsset } from "@/types/database";

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { projectId, stage } = (await request.json()) as {
    projectId?: string;
    stage?: 1 | 2;
  };

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }
  if (stage !== 1 && stage !== 2) {
    return NextResponse.json({ error: "stage must be 1 or 2" }, { status: 400 });
  }

  if (stage === 2) {
    const { data: existingAssets } = await supabase
      .from("generated_assets")
      .select("asset_key, approval_status")
      .eq("project_id", projectId)
      .returns<Pick<GeneratedAsset, "asset_key" | "approval_status">[]>();

    if (!stage1FoundationalApproved(existingAssets ?? [])) {
      return NextResponse.json(
        {
          error:
            "Stage 2 (Brand Guidelines, Messaging Framework) is locked until both Stage 1 documents (ICP, Brand Identity) are approved.",
        },
        { status: 403 }
      );
    }
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

  const { data: projectRow } = await supabase
    .from("projects")
    .select("client_id")
    .eq("id", projectId)
    .maybeSingle();

  const results = await generateFoundationalBatch(
    supabase,
    projectId,
    onboarding.answers,
    projectRow?.client_id ?? null,
    stage
  );

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `${failures.length} of ${results.length} Stage ${stage} documents failed to generate.`,
        results,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ success: true, results });
}
