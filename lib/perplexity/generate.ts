// Client for Perplexity's Agent API.
//
// Deliberately NOT the older "Sonar API" (api.perplexity.ai/v1/sonar,
// OpenAI-compatible chat-completions shape) -- Perplexity is sunsetting
// that endpoint on September 27, 2026, so building against it now would
// mean redoing this within about a month. The Agent API
// (api.perplexity.ai/v1/agent) is the current, actively-developed
// replacement and is confirmed (via Perplexity's own Agent API model
// catalog) to support Perplexity's own native Sonar models directly via
// model: "perplexity/sonar" -- not just third-party models routed through
// their platform, which is what "use Perplexity" actually means here.
//
// NOTE: written directly against Perplexity's documented API contract as
// of this writing. This sandbox's network egress does not allow
// api.perplexity.ai, so none of this has been exercised against the real
// API -- test end-to-end against a live PERPLEXITY_API_KEY before relying
// on it in production, same as every other new external integration in
// this project.

const PERPLEXITY_AGENT_URL = "https://api.perplexity.ai/v1/agent";
export const PERPLEXITY_MODEL = "perplexity/sonar";

function getApiKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY is not set");
  return key;
}

// Perplexity's own citation format ([web:1], [page:2], etc.) makes sense
// inline on their own UI with a source list attached, but reads as broken
// formatting in a docx with no bibliography attached. Strip it rather than
// try to preserve or reformat it -- the underlying claim still needs to
// pass this app's usual "don't invent facts" guardrails regardless of
// whether a citation marker was attached to it.
function stripCitationMarkers(text: string): string {
  return text
    .replace(/\[(?:web|page|conversation_history|memory|attached_file|calendar_event):\d+\]/g, "")
    .replace(/ {2,}/g, " ")
    .replace(/ ([.,;:!?])/g, "$1");
}

interface AgentApiOutputItem {
  type: string;
  content?: { type: string; text: string }[];
}

interface AgentApiResponse {
  status: string;
  error?: { message: string } | null;
  output: AgentApiOutputItem[];
}

// Mirrors this app's generateAssetContent(systemPrompt, userPrompt, maxTokens)
// signature so it can be swapped in per-asset without changing call sites
// beyond picking which function to call.
export async function generatePerplexityContent(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const res = await fetch(PERPLEXITY_AGENT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      input: userPrompt,
      instructions:
        systemPrompt +
        "\n\nYou have a web_search tool available. Use it to ground this document in current, real information about the fund's market, category, and comparable firms where relevant. Use short queries (2-5 words), no more than a few searches, and never ask permission to search -- just search when it would improve the document.",
      tools: [{ type: "web_search" }],
      max_output_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Perplexity Agent API request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as AgentApiResponse;

  if (data.status !== "completed") {
    throw new Error(data.error?.message ?? `Perplexity generation did not complete (status: ${data.status})`);
  }

  // Mirrors the official SDKs' `output_text` convenience property: collect
  // every output_text content block across every message-type output item,
  // in order, and join them -- the response can interleave search_results/
  // fetch_url_results items alongside one or more message items.
  const text = data.output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text)
    .join("\n\n");

  if (!text.trim()) {
    throw new Error("Perplexity response contained no text output");
  }

  return stripCitationMarkers(text).trim();
}
