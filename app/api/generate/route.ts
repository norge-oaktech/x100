import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetTemplate } from "@/config/assets";
import { generateAssetContent, ANTHROPIC_MODEL } from "@/lib/anthropic/generate";

export async function POST(request: Request) {
  const supabase = createClient();

  // Only authenticated team members can trigger generation — this is the
  // cost/abuse gate. The public onboarding form never calls this route.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { projectId, assetKey } = await request.json();

  if (!projectId || !assetKey) {
    return NextResponse.json(
      { error: "Missing projectId or assetKey" },
      { status: 400 }
    );
  }

  const template = getAssetTemplate(assetKey);
  if (!template) {
    return NextResponse.json({ error: "Unknown asset" }, { status: 400 });
  }

  const { data: onboarding } = await supabase
    .from("onboarding_responses")
    .select("answers")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!onboarding) {
    return NextResponse.json(
      { error: "No onboarding answers found for this project" },
      { status: 400 }
    );
  }

  const userPrompt = template.buildUserPrompt(onboarding.answers);

  const { data: assetRow, error: insertError } = await supabase
    .from("generated_assets")
    .insert({
      project_id: projectId,
      asset_key: template.id,
      status: "generating",
      prompt_snapshot: userPrompt,
    })
    .select("id")
    .single();

  if (insertError || !assetRow) {
    return NextResponse.json(
      { error: insertError?.message ?? "Could not create asset row" },
      { status: 500 }
    );
  }

  try {
    const content = await generateAssetContent(
      template.systemPrompt,
      userPrompt,
      template.maxTokens
    );

    await supabase
      .from("generated_assets")
      .update({
        status: "complete",
        content,
        model_used: ANTHROPIC_MODEL,
        generated_at: new Date().toISOString(),
      })
      .eq("id", assetRow.id);

    // Only advance status forward from onboarding_complete — a project
    // already mid-generation for another asset shouldn't get bumped back.
    await supabase
      .from("projects")
      .update({ status: "generating", updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .eq("status", "onboarding_complete");

    return NextResponse.json({ success: true, assetId: assetRow.id, content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    await supabase
      .from("generated_assets")
      .update({ status: "failed", error: message })
      .eq("id", assetRow.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
