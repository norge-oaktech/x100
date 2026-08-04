// Data-driven asset template registry.
//
// Adding asset #2 through #100 later = appending an object to ASSET_TEMPLATES
// below. Nothing else in the app (the generate route, the dashboard panel)
// branches on individual asset ids — they all just iterate this array.

export type AssetFormat = "docx" | "pdf" | "both";

export type AssetCategory =
  | "email"
  | "website"
  | "landing_page"
  | "social"
  | "ad"
  | "sales"
  | "voicemail"
  | "faq";

type OnboardingAnswers = Record<string, string | string[]>;

export interface AssetTemplate {
  id: string; // stable key, stored in generated_assets.asset_key — never change once used
  label: string; // shown in the dashboard
  category: AssetCategory;
  outputFormat: AssetFormat;
  systemPrompt: string;
  buildUserPrompt: (answers: OnboardingAnswers) => string;
  maxTokens?: number;
}

// Pulls a field's saved onboarding answer by its config/onboardingSchema.ts
// field id, joining multi-select arrays into a readable list.
function val(
  answers: OnboardingAnswers,
  fieldId: string,
  fallback = "Not provided"
): string {
  const v = answers[fieldId];
  if (!v || (Array.isArray(v) && v.length === 0)) return fallback;
  return Array.isArray(v) ? v.join(", ") : v;
}

export const ASSET_TEMPLATES: AssetTemplate[] = [
  {
    id: "cold_outreach_email_1",
    label: "Cold Outreach Email — Investor Introduction",
    category: "email",
    outputFormat: "docx",
    systemPrompt:
      "You are a placement-agent-caliber copywriter writing on behalf of a fund's Managing Partner to a prospective LP who has never interacted with the fund. Match the fund's stated communication style exactly — do not default to generic salesy language. Keep the email under 150 words. Output a Subject line on the first line, then a blank line, then the email body. Do not include any preamble, explanation, or commentary — output only the subject and email body.",
    buildUserPrompt: (a) =>
      `
Fund strategy summary: ${val(a, "summary_of_fund_strategy")}
Fund mandate: ${val(a, "what_is_the_fund_mandate")}
Key differentiators: ${val(a, "what_are_the_top_key_differentiators_of_your_fund")}
Target investor profile: ${val(a, "what_type_of_investors_are_you_trying_to_target")}
What motivates these investors: ${val(a, "what_motivates_investors_to_allocate_capital_to_your_fund")}
Leadership communication style: ${val(a, "how_would_you_describe_the_communication_style_of_the_leader")}
Words/phrases to avoid: ${val(a, "what_words_or_phrases_should_never_be_used")}

Write a first-touch cold outreach email introducing the fund to a prospective investor who fits the target profile above.
      `.trim(),
    maxTokens: 500,
  },
];

export function getAssetTemplate(id: string) {
  return ASSET_TEMPLATES.find((a) => a.id === id);
}
