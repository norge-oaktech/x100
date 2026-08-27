// Client for the Gamma Generate API (v1.0, GA since Nov 2025).
// https://developers.gamma.app/ -- base URL public-api.gamma.app/v1.0/,
// auth via X-API-KEY (not Authorization: Bearer). Generation is
// asynchronous: POST /generations returns a generationId, then GET
// /generations/{id} is polled until status is "completed" or "failed".
//
// NOTE: written directly against Gamma's documented API contract as of
// this writing. This sandbox's network egress does not allow
// public-api.gamma.app, so none of this has been exercised against the
// real API -- test end-to-end against a live GAMMA_API_KEY before relying
// on it in production, the same way any new library integration in this
// project is supposed to be runtime-verified, not just type-checked.

const GAMMA_BASE_URL = "https://public-api.gamma.app/v1.0";

function getApiKey(): string {
  const key = process.env.GAMMA_API_KEY;
  if (!key) throw new Error("GAMMA_API_KEY is not set");
  return key;
}

export type GammaFormat = "presentation" | "document" | "social" | "webpage";
export type GammaExportAs = "pptx" | "pdf";

interface CreateGenerationParams {
  inputText: string;
  format?: GammaFormat;
  exportAs?: GammaExportAs;
  numCards?: number;
  title?: string;
}

interface GammaGenerationStatus {
  generationId: string;
  status: "pending" | "processing" | "completed" | "failed";
  gammaUrl?: string;
  exportUrl?: string;
  error?: string;
}

export async function createGammaGeneration(
  params: CreateGenerationParams
): Promise<string> {
  const res = await fetch(`${GAMMA_BASE_URL}/generations`, {
    method: "POST",
    headers: {
      "X-API-KEY": getApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputText: params.inputText,
      textMode: "generate",
      format: params.format ?? "presentation",
      exportAs: params.exportAs ?? "pptx",
      ...(params.numCards ? { numCards: params.numCards } : {}),
      ...(params.title ? { title: params.title } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gamma createGeneration failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  if (!data.generationId) {
    throw new Error("Gamma createGeneration response missing generationId");
  }
  return data.generationId as string;
}

async function getGammaGenerationStatus(
  generationId: string
): Promise<GammaGenerationStatus> {
  const res = await fetch(`${GAMMA_BASE_URL}/generations/${generationId}`, {
    headers: { "X-API-KEY": getApiKey() },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gamma getGenerationStatus failed (${res.status}): ${body}`);
  }

  return (await res.json()) as GammaGenerationStatus;
}

// Polls until completed/failed or the time budget runs out. Vercel's
// maxDuration on the calling route is the hard ceiling -- default budget
// here is 150s (leaves headroom under the route's 180s limit for the
// Claude call + upload/DB writes that happen around this).
export async function pollGammaGeneration(
  generationId: string,
  { timeoutMs = 150_000, intervalMs = 4_000 } = {}
): Promise<GammaGenerationStatus> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await getGammaGenerationStatus(generationId);
    if (status.status === "completed" || status.status === "failed") {
      return status;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Gamma generation ${generationId} timed out after ${timeoutMs}ms`);
}

export async function downloadGammaExport(exportUrl: string): Promise<Buffer> {
  const res = await fetch(exportUrl);
  if (!res.ok) {
    throw new Error(`Downloading Gamma export failed (${res.status})`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Convenience wrapper: create, poll to completion, download the exported
// file. Throws on any failure -- callers use the same best-effort
// try/catch pattern as every other file-build step in this app (deck
// build failing doesn't fail the text generation, which already
// succeeded).
export async function generateGammaPptx(
  inputText: string,
  opts: { numCards?: number; title?: string } = {}
): Promise<Buffer> {
  const generationId = await createGammaGeneration({
    inputText,
    format: "presentation",
    exportAs: "pptx",
    numCards: opts.numCards,
    title: opts.title,
  });

  const status = await pollGammaGeneration(generationId);
  if (status.status === "failed" || !status.exportUrl) {
    throw new Error(status.error ?? "Gamma generation failed or returned no exportUrl");
  }

  return downloadGammaExport(status.exportUrl);
}
