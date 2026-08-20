import type { AssetTemplate } from "@/config/assets";

type OnboardingAnswers = Record<string, string | string[]>;

function val(answers: OnboardingAnswers, fieldId: string, fallback = ""): string {
  const v = answers[fieldId];
  if (!v || (Array.isArray(v) && v.length === 0)) return fallback;
  return Array.isArray(v) ? v.join(", ") : v;
}

// Shared safety/quality guardrails appended to every image prompt regardless
// of asset type. Generic, non-identifiable people ARE welcome -- the rule
// is narrower than "no people": image models cannot accurately render a
// real, specific person's likeness, so depicting one produces either a
// generic-looking stranger mislabeled as that person, or an inaccurate
// result. Anonymous, natural-looking people avoid that problem entirely.
const IMAGE_GUARDRAILS = `

HARD RULES:
- Depict exactly ONE cohesive visual idea, well-composed and well-lit. Do NOT create a collage, grid, or scattered arrangement of multiple small unrelated icons or symbols.
- Explicitly avoid generic corporate-stock-art tropes: no dashboard/gauge charts, no line/bar graphs, no generic "upward arrow," no generic city-skyline silhouettes used as the whole subject, no laptop/monitor mockups, no handshake icons, no lightbulb icons.
- Generic, non-identifiable people are welcome and encouraged when they fit the content below -- unnamed, natural-looking, diverse, candid rather than posed or smiling-at-camera stock-photo style. The only restriction: never depict a specific real, named individual -- always generic/anonymous people instead.
- Do not include any legible text, words, letters, or numbers rendered in the image.
- Do not include any real company logos, trademarks, or copyrighted characters.
- Use a tight, deliberate palette of 2-3 colors only, applied consistently -- not a rainbow of unrelated colors.
- Render with genuine depth and material quality (real shadow, light direction, skin/fabric/paper/stone texture as appropriate) rather than flat clip-art shading.
- Style should look like premium, gallery-quality editorial art direction or high-end commercial photography -- the kind of image a top-tier design agency would produce for an asset management firm's brand campaign, not a generic stock-photo library graphic.`;

const PLATFORM_HINTS: Record<string, string> = {
  linkedin_post: "A polished, premium graphic for a LinkedIn post from an institutional investment firm.",
  x_post: "A striking, minimal graphic for a short-form X post.",
  facebook_post: "A polished, premium graphic for a Facebook post from an institutional investment firm.",
  reddit_post:
    "A simple, understated supporting image -- Reddit audiences respond poorly to obvious marketing visuals, so keep it quiet and non-corporate-feeling despite the premium execution.",
  bluesky_post: "A striking, minimal graphic.",
  tiktok_script: "A bold vertical cover/thumbnail image for a short-form video.",
  investor_teaser: "A premium, editorial banner image for an institutional investor teaser document.",
  event_banner: "A premium, editorial event promotional banner image.",
};

// Builds a reasonable default image prompt for an asset. If the asset's
// generated text content is available, the image is grounded in that
// content's actual message rather than a generic rotating concept list --
// this is what makes the image relevant to the specific post instead of a
// disconnected abstract graphic. Falls back to onboarding visual-style
// fields alone only if content isn't available for some reason. The staff
// member can override this entirely via the custom-prompt field in the UI.
export function buildDefaultImagePrompt(
  template: AssetTemplate,
  answers: OnboardingAnswers,
  content?: string | null
): string {
  const visualStyle = val(answers, "preferred_visual_style", "institutional, modern, minimalist");
  const visualsFeel = val(answers, "visuals_feel", "professional, credible");
  const platformHint = PLATFORM_HINTS[template.id] ?? "A premium marketing graphic for an institutional investment firm.";

  const styleLine = `Palette and mood should reflect: ${visualStyle}, feeling ${visualsFeel}.`;

  if (content && content.trim().length > 0) {
    // Cap length so the copy doesn't overwhelm the image prompt -- the goal
    // is grounding the concept in the actual message, not reproducing the
    // whole post as instructions.
    const trimmedContent = content.trim().slice(0, 1200);

    return `${platformHint}

Below is the actual marketing copy this image will appear alongside. Read it and create ONE specific visual concept that genuinely reflects its core message or theme -- do not default to a generic or unrelated abstract graphic. Choose whichever fits the copy's actual content: a candid editorial photograph involving generic (non-identifiable) people if the copy is about partnership, collaboration, people, or operational support; or a considered abstract/architectural composition if the copy is more about market thesis, structure, or numbers. Let the copy's specific content -- not a random default -- determine which.

MARKETING COPY:
"""
${trimmedContent}
"""

${styleLine}${IMAGE_GUARDRAILS}`;
  }

  // Fallback: no content available to ground the concept in (shouldn't
  // normally happen, since image generation requires completed text).
  return `${platformHint}

Create one considered, premium visual concept appropriate for an institutional investment firm's marketing material -- either a candid editorial photograph with generic non-identifiable people, or an abstract architectural/sculptural composition.

${styleLine}${IMAGE_GUARDRAILS}`;
}
