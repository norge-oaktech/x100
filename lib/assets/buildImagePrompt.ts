import type { AssetTemplate } from "@/config/assets";

type OnboardingAnswers = Record<string, string | string[]>;

function val(answers: OnboardingAnswers, fieldId: string, fallback = ""): string {
  const v = answers[fieldId];
  if (!v || (Array.isArray(v) && v.length === 0)) return fallback;
  return Array.isArray(v) ? v.join(", ") : v;
}

// Shared safety/quality guardrails appended to every image prompt regardless
// of asset type -- image models render legible text poorly, and depicting
// real named individuals or third-party logos is both inaccurate (the model
// has no real photo of them) and a brand/legal risk.
const IMAGE_GUARDRAILS = `
Do not include any legible text, words, letters, or numbers rendered in the image. Do not depict any specific real, named individual (image models cannot accurately render a real person's likeness). Do not include any real company logos, trademarks, or copyrighted characters. Style: abstract, editorial, institutional -- suitable for a private investment fund's professional marketing material, not literal or cartoonish.`;

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
    linkedin_post: "A professional social media graphic suitable for a LinkedIn post.",
    x_post: "A clean, minimal social media graphic suitable for a short-form X post.",
    facebook_post: "An approachable but professional social media graphic for Facebook.",
    reddit_post:
      "A simple, non-corporate-looking supporting image -- Reddit audiences respond poorly to obvious marketing visuals, so keep it understated.",
    bluesky_post: "A clean, minimal social media graphic.",
    tiktok_script: "A vertical cover/thumbnail image for a short-form video.",
    investor_teaser: "A polished, institutional banner image suitable for an investor teaser document.",
    event_banner: "A polished event promotional banner image.",
  };

  const platformHint = platformHints[template.id] ?? "A professional marketing graphic.";

  return `${platformHint} Visual style: ${visualStyle}. Overall feel: ${visualsFeel}. Evoke the theme through abstract composition, color, and imagery (e.g. geometric patterns, architecture, technology-adjacent abstract visuals) -- not literal depictions of any sector or company.${IMAGE_GUARDRAILS}`;
}
