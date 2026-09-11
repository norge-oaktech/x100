import type { SupabaseClient } from "@supabase/supabase-js";
import { getHeygenVideoStatus, downloadHeygenVideo } from "@/lib/heygen/generate";

export type AttachHeygenResult =
  | { attached: true }
  | { attached: false; reason: "not_started" | "pending" | "failed" | "error"; message?: string };

// Re-fetches the authoritative status from HeyGen (never trusts a webhook
// body's own claims about what happened) and, if the render is done,
// downloads the mp4 and attaches it as an asset_files row -- same
// best-effort pattern as every other secondary file attachment in this
// app (images, decks, calendars): failing here never touches the text
// asset, which already succeeded independently.
export async function attachHeygenVideoIfReady(
  supabase: SupabaseClient,
  assetRow: { id: string; project_id: string; asset_key: string; heygen_video_id: string | null }
): Promise<AttachHeygenResult> {
  if (!assetRow.heygen_video_id) {
    return { attached: false, reason: "not_started" };
  }

  try {
    const status = await getHeygenVideoStatus(assetRow.heygen_video_id);

    if (status.status === "failed") {
      return { attached: false, reason: "failed", message: status.failure_message };
    }
    if (status.status !== "completed" || !status.video_url) {
      return { attached: false, reason: "pending" };
    }

    const videoBuffer = await downloadHeygenVideo(status.video_url);
    const storagePath = `${assetRow.project_id}/${assetRow.asset_key}/${crypto.randomUUID()}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from("asset-documents")
      .upload(storagePath, videoBuffer, { contentType: "video/mp4" });

    if (uploadError) {
      return { attached: false, reason: "error", message: uploadError.message };
    }

    await supabase.from("asset_files").insert({
      generated_asset_id: assetRow.id,
      format: "mp4",
      storage_path: storagePath,
    });

    return { attached: true };
  } catch (err) {
    return {
      attached: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
