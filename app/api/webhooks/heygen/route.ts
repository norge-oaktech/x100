import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getHeygenVideoStatus, downloadHeygenVideo } from "@/lib/heygen/generate";

// HeyGen calls this when a video render completes or fails (registered via
// the callback_url set on each POST /v3/videos request in
// lib/heygen/generate.ts). Not authenticated the normal way -- this route
// is meant to be reachable by HeyGen's servers -- so it deliberately trusts
// nothing from the request body about *what* happened, only *which video*
// it's about, and re-fetches the authoritative status/video_url itself via
// GET /v3/videos/{id} rather than trusting whatever fields the webhook
// payload happens to include. This sidesteps needing to have confirmed the
// exact webhook body shape against a live account.
//
// Correlates back to a generated_assets row two ways, in order: the
// callback_id we set at creation time (== that row's id, if HeyGen echoes
// it back in the webhook body), then falling back to matching the video id
// itself against generated_assets.heygen_video_id. Either is sufficient on
// its own; having both is just resilience against not being 100% sure
// which one arrives in the payload.
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
        .select("id, project_id, asset_key")
        .eq("id", callbackId)
        .maybeSingle()
    : await supabase
        .from("generated_assets")
        .select("id, project_id, asset_key")
        .eq("heygen_video_id", videoId)
        .maybeSingle();

  if (!assetRow) {
    // Could be a webhook for a video this app didn't create, or one whose
    // owning asset was since deleted. Acknowledge either way -- returning
    // an error would just make HeyGen retry a callback we'll never match.
    return NextResponse.json({ received: true, matched: false });
  }

  const resolvedVideoId = videoId ?? callbackId;
  if (!resolvedVideoId) {
    return NextResponse.json({ received: true, matched: false });
  }

  try {
    const status = await getHeygenVideoStatus(resolvedVideoId);

    if (status.status !== "completed" || !status.video_url) {
      // Failed render (or a "processing" callback some accounts send
      // mid-flight) -- nothing to attach. Log for Vercel's function logs
      // since this failure is otherwise invisible (the text asset stays
      // "complete" regardless, same as a failed Gamma/image build).
      if (status.status === "failed") {
        console.error(
          `HeyGen video ${resolvedVideoId} failed for asset ${assetRow.id}: ${status.failure_message ?? "no message"}`
        );
      }
      return NextResponse.json({ received: true, matched: true, attached: false });
    }

    const videoBuffer = await downloadHeygenVideo(status.video_url);
    const storagePath = `${assetRow.project_id}/${assetRow.asset_key}/${crypto.randomUUID()}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("asset-documents")
      .upload(storagePath, videoBuffer, { contentType: "video/mp4" });

    if (!uploadError) {
      await supabase.from("asset_files").insert({
        generated_asset_id: assetRow.id,
        format: "mp4",
        storage_path: storagePath,
      });
    }

    return NextResponse.json({ received: true, matched: true, attached: !uploadError });
  } catch (err) {
    console.error(
      `HeyGen webhook processing failed for asset ${assetRow.id}:`,
      err instanceof Error ? err.message : err
    );
    // Still 200 -- this is a best-effort attachment, not a critical path,
    // and a non-2xx here would just cause HeyGen to retry indefinitely.
    return NextResponse.json({ received: true, matched: true, attached: false });
  }
}
