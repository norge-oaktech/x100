import { ONBOARDING_SECTIONS } from "@/config/onboardingSchema";

// The downloadable questionnaire a client can fill out themselves, or paste
// into ChatGPT/Claude and have answered on their behalf, then upload back
// on the onboarding page. Plain Markdown, not a form -- it's meant to be
// read and answered as prose/text, matching how someone would actually
// paste it into another AI assistant.
export function buildQuestionnaireMarkdown(): string {
  const lines: string[] = [
    "# Fund Onboarding Questionnaire",
    "",
    "Answer every question you can. If one doesn't apply, write \"N/A\" rather than leaving it blank.",
    "",
    "For questions with a fixed list of options in parentheses, answer using one or more of those exact options.",
    "",
  ];

  for (const section of ONBOARDING_SECTIONS) {
    lines.push(`## ${section.title}`, "");
    if (section.description) {
      lines.push(section.description, "");
    }
    for (const field of section.fields) {
      const optionsHint =
        field.type === "multi_select" && field.options?.length
          ? ` (choose one or more: ${field.options.join(", ")})`
          : "";
      lines.push(`**${field.label}**${optionsHint}`, "Answer: ", "");
    }
  }

  return lines.join("\n");
}

// Compact field reference (id, label, type, options) handed to Claude when
// parsing a completed questionnaire back into structured answers -- this is
// what lets the extraction map free text onto the right field id rather
// than the wizard's own display labels.
export function buildFieldReferenceForExtraction(): string {
  const lines: string[] = [];
  for (const section of ONBOARDING_SECTIONS) {
    lines.push(`## ${section.title}`);
    for (const field of section.fields) {
      const optionsPart = field.options?.length
        ? ` | options: ${JSON.stringify(field.options)}`
        : "";
      lines.push(`- id: "${field.id}" | label: "${field.label}" | type: ${field.type}${optionsPart}`);
    }
  }
  return lines.join("\n");
}
