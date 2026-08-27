// Claude models occasionally wrap output in a markdown code fence (```json,
// ```html, or a bare ```) even when the system prompt explicitly says not
// to. Anywhere downstream code needs the raw string -- JSON.parse for
// deck/calendar assets, a direct paste into GHL's Custom HTML element for
// html assets -- a stray fence breaks that, so strip one if present before
// handing the string to a stricter consumer. No-op if there's no fence.
export function stripCodeFence(content: string): string {
  return content
    .trim()
    .replace(/^```(?:[a-zA-Z]*)\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}
