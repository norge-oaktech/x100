import type { AssetTemplate } from "@/config/assets";

type OnboardingAnswers = Record<string, string | string[]>;

function val(answers: OnboardingAnswers, fieldId: string, fallback = ""): string {
  const v = answers[fieldId];
  if (!v || (Array.isArray(v) && v.length === 0)) return fallback;
  return Array.isArray(v) ? v.join(", ") : v;
}

// A rotating set of single, cohesive visual concepts. Picking ONE concrete
// concept and committing to it is what actually produces an engaging image
// -- the previous version asked for "abstract composition evoking a theme,"
// which is exactly the kind of open-ended instruction that pushes image
// models toward generic corporate-clipart collages (dashboards, gauges,
// office buildings, arrows, all scattered together with no single idea
// tying them together). One clear idea, rendered well, beats five vague
// ones combined.
const VISUAL_CONCEPTS = [
  "a single large abstract sculptural form suggesting upward momentum or ascent -- like a minimalist folded-paper or origami peak catching light, photographed as a clean studio object shot",
  "a close-up abstract composition of layered geometric planes at an angle, like architectural facades or terraced landscape contours, with strong directional light creating depth and shadow",
  "an abstract macro shot of intersecting curved lines and gradients suggesting a flow or current, rendered as a smooth 3D render with soft studio lighting",
  "a minimalist isometric composition of a few large simple geometric solids (spheres, blocks, slabs) arranged with intentional negative space, like a piece of gallery sculpture",
  "an abstract aerial/topographic composition of overlapping translucent layered shapes suggesting depth and structure, rendered with soft gradients and subtle grain",
];

// Shared safety/quality guardrails appended to every image prompt regardless
// of asset type -- image models render legible text poorly, and depicting
// real named individuals or third-party logos is both inaccurate (the model
// has no real photo of them) and a brand/legal risk. Also explicitly bans
// the generic-corporate-clipart failure mode we saw in practice.
const IMAGE_GUARDRAILS = `

HARD RULES:
- Depict exactly ONE cohesive visual idea, well-composed and well-lit. Do NOT create a collage, grid, or scattered arrangement of multiple small unrelated icons or symbols.
- Explicitly avoid generic corporate-stock-art tropes: no dashboard/gauge charts, no line/bar graphs, no generic "upward arrow," no generic city-skyline silhouettes, no laptop/monitor mockups, no handshake icons, no lightbulb icons.
- Do not include any legible text, words, letters, or numbers rendered in the image.
- Do not depict any specific real, named individual.
- Do not include any real company logos, trademarks, or copyrighted characters.
- Use a tight, deliberate palette of 2-3 colors only, applied consistently -- not a rainbow of unrelated colors.
- Render with genuine depth: real shadow, light direction, and material quality (paper, stone, glass, metal, etc.) rather than flat clip-art shading.`;

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

Palette and mood should reflect: ${visualStyle}, feeling ${visualsFeel}. This should look like premium, gallery-quality editorial art direction -- the kind of image a top-tier design agency would produce for an asset management firm's brand campaign, not a stock-photo library graphic.${IMAGE_GUARDRAILS}`;
}
