import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { attachHeygenVideoIfReady } from "@/lib/heygen/attachVideo";

// Lets a signed-in team member manually check (and attach, if ready) a
// HeyGen video instead of only waiting on the webhook callback. This is
// the fallback for the single most likely failure mode of the webhook
// approach: the callback_url was never registered in HeyGen's dashboard,
// so a finished render just never gets reported back to this app. Safe to
// click repeatedly -- it's idempotent (re-checking an already-attached or
// still-pending video is a no-op either way).
export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { generatedAssetId } = (await request.json()) as {
    generatedAssetId?: string;
  };

  if (!generatedAssetId) {
    return NextResponse.json({ error: "Missing generatedAssetId" }, { status: 400 });
  }

  const { data: assetRow } = await supabase
    .from("generated_assets")
    .select("id, project_id, asset_key, heygen_video_id")
    .eq("id", generatedAssetId)
    .maybeSingle();

  if (!assetRow) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const result = await attachHeygenVideoIfReady(supabase, assetRow);

  if (result.attached) {
    return NextResponse.json({ success: true, attached: true });
  }

  const messages: Record<string, string> = {
    not_started:
      "No HeyGen render was ever recorded for this asset. Regenerate it to start a new render.",
    pending: "Still rendering on HeyGen's side — check back in a bit.",
    failed: `HeyGen reported this render failed${result.message ? `: ${result.message}` : "."} Regenerate to try again.`,
    error: `Couldn't check status right now${result.message ? `: ${result.message}` : "."} Try again in a moment.`,
  };

  return NextResponse.json({
    success: true,
    attached: false,
    message: messages[result.reason] ?? "Not ready yet.",
  });
}
