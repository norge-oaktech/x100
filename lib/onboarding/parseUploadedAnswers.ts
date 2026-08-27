import { ONBOARDING_SECTIONS } from "@/config/onboardingSchema";
import { generateAssetContent } from "@/lib/anthropic/generate";
import { stripCodeFence } from "@/lib/assets/stripCodeFence";
import { buildFieldReferenceForExtraction } from "./questionnaireMarkdown";

type Answers = Record<string, string | string[]>;

const EXTRACTION_SYSTEM_PROMPT = `You extract structured answers from a completed fund onboarding questionnaire and map them onto a fixed set of known field ids. The source text may have been filled out by a human directly, or drafted by another AI assistant on the client's behalf -- either is fine, treat it the same way.

You will be given:
1. A field reference: every known field's id, label, type, and (for multi_select fields) its exact list of allowed options.
2. The raw completed questionnaire text to extract from.

Rules:
- Match each answer to the field it most clearly responds to, using the field's label and surrounding section title as context -- the source text won't necessarily use the exact same wording as the label, or the same order.
- For "multi_select" fields, only ever output values that are an exact string from that field's options list. If the source text describes something that doesn't clearly correspond to any listed option, omit that field rather than guessing.
- For "text", "email", "tel", and "textarea" fields, extract the answer as free text, lightly cleaned up (no markdown formatting, no leading "Answer:" label) but otherwise in the client's own words -- do not rewrite, summarize, or improve it.
- If a question was left blank, skipped, or the source text says something equivalent to "N/A" / "not applicable" / "skip", omit that field entirely rather than inventing a placeholder.
- Never invent an answer that isn't actually present in the source text.
- If the same field seems to be answered in more than one place, use the most complete/specific answer.

OUTPUT FORMAT -- CRITICAL
Output ONLY a JSON object mapping field id to answer, nothing before or after it, no markdown code fences, no commentary. Example shape:
{
  "company_name": "Example Fund LP",
  "core_values": ["Integrity", "Transparency"]
}
Only include fields you found an actual answer for. Do not include fields with no answer.`;

interface ExtractionResult {
  answers: Answers;
  matchedFieldCount: number;
  totalFieldCount: number;
}

export async function extractAnswersFromUploadedText(
  rawText: string
): Promise<ExtractionResult> {
  const fieldReference = buildFieldReferenceForExtraction();

  const userPrompt = `FIELD REFERENCE:
${fieldReference}

COMPLETED QUESTIONNAIRE TEXT TO EXTRACT FROM:
"""
${rawText.slice(0, 100_000)}
"""

Extract the answers as JSON in the exact format described above.`;

  const raw = await generateAssetContent(EXTRACTION_SYSTEM_PROMPT, userPrompt, 8000);
  const parsed = JSON.parse(stripCodeFence(raw));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Extraction did not return a JSON object");
  }

  // Only keep keys that are real, known field ids -- never trust the model
  // to only emit ids from the reference we gave it, and never let an
  // uploaded file inject an arbitrary key into onboarding_responses.answers.
  const validIds = new Set<string>();
  for (const section of ONBOARDING_SECTIONS) {
    for (const field of section.fields) validIds.add(field.id);
  }

  const answers: Answers = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!validIds.has(key)) continue;
    if (typeof value === "string" && value.trim() !== "") {
      answers[key] = value;
    } else if (
      Array.isArray(value) &&
      value.every((v) => typeof v === "string") &&
      value.length > 0
    ) {
      answers[key] = value as string[];
    }
  }

  return {
    answers,
    matchedFieldCount: Object.keys(answers).length,
    totalFieldCount: validIds.size,
  };
}
