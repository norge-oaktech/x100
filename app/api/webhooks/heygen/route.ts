import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { attachHeygenVideoIfReady } from "@/lib/heygen/attachVideo";

// HeyGen calls this when a video render completes or fails (registered via
// the callback_url set on each POST /v3/videos request in
// lib/heygen/generate.ts). Not authenticated the normal way -- this route
// is meant to be reachable by HeyGen's servers -- so it deliberately trusts
// nothing from the request body about *what* happened, only *which video*
// it's about. attachHeygenVideoIfReady re-fetches the authoritative
// status/video_url itself via GET /v3/videos/{id} rather than trusting
// whatever fields the webhook payload happens to include -- this sidesteps
// needing to have confirmed the exact webhook body shape against a live
// account.
//
// Correlates back to a generated_assets row two ways, in order: the
// callback_id we set at creation time (== that row's id, if HeyGen echoes
// it back in the webhook body), then falling back to matching the video id
// itself against generated_assets.heygen_video_id. Either is sufficient on
// its own; having both is just resilience against not being 100% sure
// which one arrives in the payload.
//
// IMPORTANT: this route only fires at all if the callback_url has been
// registered with HeyGen (dashboard webhook settings) -- if a video seems
// permanently stuck in "Rendering...", the most likely cause is that this
// was never set up, not a bug in this route. The "Check status" button on
// each video asset (see app/api/assets/check-heygen-status/route.ts) works
// as a fallback regardless of whether the webhook is configured.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const callbackId =
    typeof body.callback_id === "string" ? body.callback_id : undefined;
  const videoId =
    typeof body.video_id === "string"
      ? body.video_id
      : typeof body.id === "string"
        ? body.id
        : undefined;

  if (!callbackId && !videoId) {
    // Nothing usable to correlate on -- acknowledge so HeyGen doesn't keep
    // retrying a payload shape we can never resolve, but there's nothing
    // to act on.
    return NextResponse.json({ received: true, matched: false });
  }

  const supabase = createAdminClient();

  const { data: assetRow } = callbackId
    ? await supabase
        .from("generated_assets")
        .select("id, project_id, asset_key, heygen_video_id")
        .eq("id", callbackId)
        .maybeSingle()
    : await supabase
        .from("generated_assets")
        .select("id, project_id, asset_key, heygen_video_id")
        .eq("heygen_video_id", videoId)
        .maybeSingle();

  if (!assetRow) {
    // Could be a webhook for a video this app didn't create, or one whose
    // owning asset was since deleted. Acknowledge either way -- returning
    // an error would just make HeyGen retry a callback we'll never match.
    return NextResponse.json({ received: true, matched: false });
  }

  // The webhook fires per-video, so if our stored heygen_video_id is
  // somehow empty (shouldn't happen if this row is the one HeyGen is
  // calling about) fall back to whichever id arrived in the payload.
  const rowForAttach = {
    ...assetRow,
    heygen_video_id: assetRow.heygen_video_id ?? videoId ?? callbackId ?? null,
  };

  const result = await attachHeygenVideoIfReady(supabase, rowForAttach);

  if (result.attached === false && result.reason === "failed") {
    console.error(
      `HeyGen video failed for asset ${assetRow.id}: ${result.message ?? "no message"}`
    );
  } else if (result.attached === false && result.reason === "error") {
    console.error(
      `HeyGen webhook processing failed for asset ${assetRow.id}: ${result.message ?? "unknown error"}`
    );
  }

  // Always 200 -- this is a best-effort attachment, not a critical path,
  // and a non-2xx here would just cause HeyGen to retry indefinitely.
  return NextResponse.json({ received: true, matched: true, attached: result.attached });
}
