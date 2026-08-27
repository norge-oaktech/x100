// Client for HeyGen's v3 API -- specifically the "Avatar Video" endpoint
// (POST /v3/videos, type: "avatar"), which takes an exact pre-written
// script and renders it verbatim. Deliberately NOT the "Video Agent"
// endpoint (/v3/video-agents) or Cinematic Avatar mode -- both of those
// write their OWN script from a loose prompt, which would mean HeyGen
// freely rewriting fund-related messaging with no compliance review. This
// app already generates a carefully-guardrailed script via Claude; HeyGen's
// job here is only to perform it, not rewrite it.
//
// Deliberately NOT the older v1/v2 endpoints either -- HeyGen is retiring
// those on October 31, 2026.
//
// Avatar/voice selection: picks the first result from HeyGen's own
// avatar/voice lists at generation time rather than a hardcoded id, so
// nothing here depends on a specific avatar existing on the account. This
// means the avatar can vary between generations -- acceptable per the
// explicit choice made for this integration (see chat history); if
// brand-consistent avatar reuse across a client's assets is wanted later,
// this is the function to change (cache the chosen ids per project instead
// of re-picking "first" every call).
//
// Async architecture: HeyGen's own docs are explicit that rendering can
// take several minutes and recommend a callback_url (webhook) over
// polling, since polling would hold a serverless function open far past
// any reasonable timeout. This client only kicks off the render and
// returns immediately with a video_id -- the actual video is delivered
// later via app/api/webhooks/heygen/route.ts.
//
// NOTE: written directly against HeyGen's documented v3 API contract as of
// this writing. This sandbox's network egress does not allow
// api.heygen.com, so none of this has been exercised against the real API
// -- test end-to-end against a live HEYGEN_API_KEY before relying on it in
// production, same as every other new external integration in this
// project. In particular, the exact "type" discriminator value
// ("avatar") is inferred from HeyGen's naming convention for their other
// discriminator values (e.g. "cinematic_avatar" for the CreateVideoFromCinematicAvatar
// schema) rather than confirmed from a literal documented example -- verify
// this first if the initial test call fails with an "invalid type" error.

const HEYGEN_BASE_URL = "https://api.heygen.com";

function getApiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY is not set");
  return key;
}

function getCallbackUrl(): string | undefined {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return appUrl ? `${appUrl}/api/webhooks/heygen` : undefined;
}

async function heygenFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HEYGEN_BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": getApiKey(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HeyGen request to ${path} failed (${res.status}): ${body}`);
  }

  return (await res.json()) as T;
}

interface AvatarListItem {
  avatar_id: string;
}
interface VoiceListItem {
  voice_id: string;
}

// "Auto-pick" = take the first result HeyGen's own lists return. No
// filtering by language/gender/quality -- deliberately the simplest
// version, per the explicit choice made for this integration.
async function pickDefaultAvatarId(): Promise<string> {
  const data = await heygenFetch<{ data: { avatars: AvatarListItem[] } }>("/v3/avatars");
  const first = data.data?.avatars?.[0];
  if (!first) throw new Error("HeyGen returned no avatars to pick from");
  return first.avatar_id;
}

async function pickDefaultVoiceId(): Promise<string> {
  const data = await heygenFetch<{ data: { voices: VoiceListItem[] } }>("/v3/voices");
  const first = data.data?.voices?.[0];
  if (!first) throw new Error("HeyGen returned no voices to pick from");
  return first.voice_id;
}

interface CreateVideoResponse {
  data: { id: string; status?: string };
}

// Kicks off an async render and returns immediately with HeyGen's video_id.
// Does NOT wait for completion -- that arrives later via webhook. Callers
// should store the returned id on the owning generated_assets row (see
// generated_assets.heygen_video_id) so the webhook can find its way back.
export async function createHeygenVideo(
  script: string,
  opts: { title?: string; callbackId?: string } = {}
): Promise<string> {
  const [avatarId, voiceId] = await Promise.all([
    pickDefaultAvatarId(),
    pickDefaultVoiceId(),
  ]);

  const body: Record<string, unknown> = {
    type: "avatar",
    avatar_id: avatarId,
    voice_id: voiceId,
    script,
    output_format: "mp4",
  };
  if (opts.title) body.title = opts.title;
  if (opts.callbackId) body.callback_id = opts.callbackId;
  const callbackUrl = getCallbackUrl();
  if (callbackUrl) body.callback_url = callbackUrl;

  const res = await heygenFetch<CreateVideoResponse>("/v3/videos", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.data?.id) {
    throw new Error("HeyGen createVideo response missing video id");
  }
  return res.data.id;
}

interface VideoStatusResponse {
  data: {
    id: string;
    status: "pending" | "processing" | "completed" | "failed" | string;
    video_url?: string;
    failure_message?: string;
  };
}

// Used by the webhook handler to get the authoritative status/video_url
// rather than trusting whatever shape the webhook body itself arrives in
// (which this integration hasn't been able to verify against a live
// call) -- this GET is the one endpoint whose response shape is directly
// confirmed from HeyGen's docs.
export async function getHeygenVideoStatus(videoId: string): Promise<VideoStatusResponse["data"]> {
  const res = await heygenFetch<VideoStatusResponse>(`/v3/videos/${videoId}`);
  return res.data;
}

export async function downloadHeygenVideo(videoUrl: string): Promise<Buffer> {
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Downloading HeyGen video failed (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Pulls just the spoken-only monologue out of an asset's full generated
// text (see the <<<AVATAR_SCRIPT>>>...<<<END_AVATAR_SCRIPT>>> instruction
// in the 3 supportsHeygenVideo asset prompts in config/assets.ts). Sending
// the full document to HeyGen would mean the avatar literally speaks
// section headers and production notes aloud -- this is what keeps only
// the actual words meant to be performed.
export function extractAvatarScript(content: string): string | null {
  const match = content.match(/<<<AVATAR_SCRIPT>>>([\s\S]*?)<<<END_AVATAR_SCRIPT>>>/);
  const script = match?.[1]?.trim();
  return script && script.length > 0 ? script : null;
}
