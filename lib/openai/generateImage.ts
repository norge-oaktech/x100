import OpenAI from "openai";

const MODEL = "gpt-image-1";

let client: OpenAI | null = null;

function getClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536";

// Returns an array of base64-encoded PNG image data (one per requested
// image). gpt-image-1 always returns base64 image data directly (no URL
// response-format option like older DALL-E models), so callers upload the
// bytes themselves rather than fetching a hosted URL.
export async function generateImages(
  prompt: string,
  count: number,
  size: ImageSize = "1024x1024"
): Promise<string[]> {
  const n = Math.min(Math.max(count, 1), 10); // API supports 1-10 per call

  const response = await getClient().images.generate({
    model: MODEL,
    prompt,
    n,
    size,
    quality: "medium",
    output_format: "png",
  });

  const images = response.data
    ?.map((item) => item.b64_json)
    .filter((b64): b64 is string => Boolean(b64));

  if (!images || images.length === 0) {
    throw new Error("No image data returned from the model");
  }

  return images;
}

export { MODEL as OPENAI_IMAGE_MODEL };
