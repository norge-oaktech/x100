import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

async function callOnce(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
) {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");

  if (!textBlock || textBlock.type !== "text" || textBlock.text.trim() === "") {
    // Include stop_reason in the thrown error so failures are diagnosable
    // from the stored `error` column instead of a bare generic message.
    throw new Error(
      `No text content returned from the model (stop_reason: ${response.stop_reason ?? "unknown"})`
    );
  }

  return textBlock.text;
}

export async function generateAssetContent(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000
): Promise<string> {
  try {
    return await callOnce(systemPrompt, userPrompt, maxTokens);
  } catch (firstError) {
    // One automatic retry -- covers transient empty-response blips (seen in
    // practice: one call in a 6-call parallel batch coming back with no
    // text block while the others succeed). If the retry also fails, the
    // real error surfaces to the caller as normal.
    try {
      return await callOnce(systemPrompt, userPrompt, maxTokens);
    } catch {
      throw firstError;
    }
  }
}

export { MODEL as ANTHROPIC_MODEL };
