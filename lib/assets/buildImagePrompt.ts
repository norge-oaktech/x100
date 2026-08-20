import type { AssetTemplate } from "@/config/assets";

type OnboardingAnswers = Record<string, string | string[]>;

function val(answers: OnboardingAnswers, fieldId: string, fallback = ""): string {
  const v = answers[fieldId];
  if (!v || (Array.isArray(v) && v.length === 0)) return fallback;
  return Array.isArray(v) ? v.join(", ") : v;
}

// A rotating set of single, cohesive visual concepts. Mostly editorial
// photography featuring generic (non-identifiable) people, since that reads
// as more engaging and human than pure abstract art -- with a couple of
// abstract options kept in the mix for variety. Picking ONE concrete
// concept and committing to it is what produces an engaging image; vague
// "abstract composition evoking a theme" instructions push the model toward
// either generic corporate-clipart collages or, as it turns out, avoiding
// people altogether even when that wasn't the intent.
const VISUAL_CONCEPTS = [
  "a candid editorial-style photograph of two or three professionals in genuine, unposed conversation around a table, shot from a natural angle (not looking at camera), warm natural window light, shallow depth of field, shot on a full-frame camera with a fast prime lens",
  "an editorial photograph of a confident professional seen from behind or in partial silhouette, looking out a large window at a city skyline, warm late-afternoon directional light, cinematic depth",
  "a candid photograph of two colleagues reviewing a document together at a table, genuine natural expressions, shot from the side or a three-quarter angle, soft natural light, shallow depth of field",
  "an editorial photograph of a small team walking together through a modern office corridor or lobby, natural mid-stride movement, captured candidly rather than posed, soft directional light",
  "a single large abstract sculptural form suggesting upward momentum -- like a minimalist folded-paper or origami peak catching light, photographed as a clean studio object shot",
  "an abstract macro shot of intersecting curved lines and gradients suggesting a flow or current, rendered as a smooth 3D render with soft studio lighting",
];

// Shared safety/quality guardrails appended to every image prompt regardless
// of asset type. Generic, non-identifiable people ARE welcome (see below) --
// the rule is narrower than "no people": image models cannot accurately
// render a real, specific person's likeness, so depicting one produces
// either a generic-looking stranger mislabeled as that person, or an
// inaccurate/uncanny result. Anonymous, natural-looking people avoid that
// problem entirely and are good for engagement.
const IMAGE_GUARDRAILS = `

HARD RULES:
- Depict exactly ONE cohesive visual idea, well-composed and well-lit. Do NOT create a collage, grid, or scattered arrangement of multiple small unrelated icons or symbols.
- Explicitly avoid generic corporate-stock-art tropes: no dashboard/gauge charts, no line/bar graphs, no generic "upward arrow," no generic city-skyline silhouettes used as the whole subject, no laptop/monitor mockups, no handshake icons, no lightbulb icons.
- Generic, non-identifiable people are welcome and encouraged when the concept calls for them -- unnamed, natural-looking, diverse, candid rather than posed or smiling-at-camera stock-photo style. The only restriction: never depict a specific real, named individual (e.g. a fund's actual named partner) -- always generic/anonymous people instead.
- Do not include any legible text, words, letters, or numbers rendered in the image.
- Do not include any real company logos, trademarks, or copyrighted characters.
- Use a tight, deliberate palette of 2-3 colors only, applied consistently -- not a rainbow of unrelated colors.
- Render with genuine depth and material quality (real shadow, light direction, skin/fabric/paper/stone texture as appropriate) rather than flat clip-art shading.`;

// Builds a reasonable default image prompt for an asset, grounded in the
// fund's stated visual style preferences from onboarding. The staff member
// can override this entirely via the custom-prompt field in the UI --
// this is just the sensible starting point.
export function buildDefaultImagePrompt(
  template: AssetTemplate,
  answers: OnboardingAnswers
): string {
  const visualStyle = val(answers, "preferred_visual_style", "institutional, modern, minimalist");
  const visualsFeel = val(answers, "visuals_feel", "professional, credible");

  const platformHints: Record<string, string> = {
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

  const platformHint = platformHints[template.id] ?? "A premium marketing graphic for an institutional investment firm.";

  const concept = VISUAL_CONCEPTS[Math.floor(Math.random() * VISUAL_CONCEPTS.length)];

  return `${platformHint}

Visual concept: ${concept}.

Palette and mood should reflect: ${visualStyle}, feeling ${visualsFeel}. This should look like premium, gallery-quality editorial art direction or high-end commercial photography -- the kind of image a top-tier design agency would produce for an asset management firm's brand campaign, not a stock-photo library graphic.${IMAGE_GUARDRAILS}`;
}
