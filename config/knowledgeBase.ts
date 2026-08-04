import { ONBOARDING_SECTIONS } from "./onboardingSchema";

type OnboardingAnswers = Record<string, string | string[]>;

// Builds a "FUND KNOWLEDGE BASE" block from every answered onboarding field,
// grouped by the same sections as the wizard. Fields left blank or answered
// "N/A" are omitted so the prompt isn't padded with noise. This is what
// stands in for "this thread already contains the fund knowledgebase" in
// the original prompt materials — we don't have a persistent thread, so we
// reconstruct the equivalent context fresh on every generation call.
export function buildKnowledgeBase(answers: OnboardingAnswers): string {
  const blocks: string[] = [];

  for (const section of ONBOARDING_SECTIONS) {
    const lines: string[] = [];

    for (const field of section.fields) {
      const raw = answers[field.id];
      if (!raw || (Array.isArray(raw) && raw.length === 0)) continue;

      const value = Array.isArray(raw) ? raw.join(", ") : raw;
      if (value.trim().toLowerCase() === "n/a") continue;

      lines.push(`- ${field.label}: ${value}`);
    }

    if (lines.length > 0) {
      blocks.push(`## ${section.title}\n${lines.join("\n")}`);
    }
  }

  return blocks.length > 0
    ? blocks.join("\n\n")
    : "No onboarding details provided yet.";
}
