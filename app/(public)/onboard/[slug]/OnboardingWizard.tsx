"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ONBOARDING_SECTIONS,
  type OnboardingField,
} from "@/config/onboardingSchema";
import { buildQuestionnaireMarkdown } from "@/lib/onboarding/questionnaireMarkdown";
import {
  saveSectionAction,
  completeOnboardingAction,
  parseUploadedQuestionnaireAction,
} from "./actions";

type Answers = Record<string, string | string[]>;

function Field({
  field,
  value,
  onChange,
}: {
  field: OnboardingField;
  value: string | string[] | undefined;
  onChange: (id: string, value: string | string[]) => void;
}) {
  if (field.type === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">
          {field.label}
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {field.options?.map((option) => {
            const isChecked = selected.includes(option);
            return (
              <label
                key={option}
                className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
                  isChecked
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={isChecked}
                  onChange={() => {
                    const next = isChecked
                      ? selected.filter((o) => o !== option)
                      : [...selected, option];
                    onChange(field.id, next);
                  }}
                />
                {option}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block">
        <span className="text-sm font-medium text-slate-800">
          {field.label}
        </span>
        <textarea
          rows={3}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder="N/A if not applicable"
          className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">
        {field.label}
      </span>
      <input
        type={field.type}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(field.id, e.target.value)}
        placeholder="N/A if not applicable"
        className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
      />
    </label>
  );
}

export function OnboardingWizard({
  slug,
  initialAnswers,
  initialCompletedSections,
}: {
  slug: string;
  initialAnswers: Answers;
  initialCompletedSections: string[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [completed, setCompleted] = useState<Set<string>>(
    new Set(initialCompletedSections)
  );
  const [stepIndex, setStepIndex] = useState(() => {
    // Resume at the first incomplete section, if any
    const firstIncomplete = ONBOARDING_SECTIONS.findIndex(
      (s) => !initialCompletedSections.includes(s.id)
    );
    return firstIncomplete === -1 ? 0 : firstIncomplete;
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const section = ONBOARDING_SECTIONS[stepIndex];
  const isLastSection = stepIndex === ONBOARDING_SECTIONS.length - 1;

  const sectionAnswers = useMemo(() => {
    const out: Answers = {};
    for (const f of section.fields) {
      if (answers[f.id] !== undefined) out[f.id] = answers[f.id];
    }
    return out;
  }, [answers, section]);

  function handleFieldChange(id: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function handleDownloadMarkdown() {
    const blob = new Blob([buildQuestionnaireMarkdown()], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "onboarding-questionnaire.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleUploadCompletedFile(file: File) {
    setError(null);
    setUploadNotice(null);
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      startTransition(async () => {
        const result = await parseUploadedQuestionnaireAction(slug, text);
        setIsUploading(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        // Prefill from what was extracted, then land the client on the
        // first still-incomplete section so they review/finish it in the
        // normal wizard flow -- this never auto-submits.
        setAnswers(result.answers ?? {});
        setCompleted(new Set(result.completedSections ?? []));
        const firstIncomplete = ONBOARDING_SECTIONS.findIndex(
          (s) => !(result.completedSections ?? []).includes(s.id)
        );
        goToStep(firstIncomplete === -1 ? 0 : firstIncomplete);
        setUploadNotice(
          `Filled in ${result.matchedFieldCount} of ${result.totalFieldCount} questions from your file — review each section below and fill in anything missing before submitting.`
        );
      });
    };
    reader.onerror = () => {
      setIsUploading(false);
      setError("Could not read that file — try again.");
    };
    reader.readAsText(file);
  }

  function goToStep(index: number) {
    setStepIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNext() {
    setError(null);
    startTransition(async () => {
      const result = await saveSectionAction(slug, section.id, sectionAnswers);
      if (result.error) {
        setError("Could not save — check your connection and try again.");
        return;
      }
      setCompleted((prev) => new Set(prev).add(section.id));
      if (!isLastSection) {
        goToStep(stepIndex + 1);
      }
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const saveResult = await saveSectionAction(
        slug,
        section.id,
        sectionAnswers
      );
      if (saveResult.error) {
        setError("Could not save — check your connection and try again.");
        return;
      }
      setCompleted((prev) => new Set(prev).add(section.id));

      const result = await completeOnboardingAction(slug);
      if (result.error === "Incomplete") {
        const missingIndex = ONBOARDING_SECTIONS.findIndex((s) =>
          result.missing?.includes(s.id)
        );
        setError("Please complete all sections before submitting.");
        if (missingIndex !== -1) goToStep(missingIndex);
        return;
      }
      if (result.error) {
        setError("Could not submit — check your connection and try again.");
        return;
      }
      router.push(`/onboard/${slug}/complete`);
    });
  }

  const progressPct = Math.round(
    ((stepIndex + 1) / ONBOARDING_SECTIONS.length) * 100
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-800">
          Prefer not to fill this out field-by-field?
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Download the fillable PDF to answer it yourself — click into a
          field, or press Tab to jump to the next question — then send it
          back to us directly. Or download the plain-text version to paste
          into ChatGPT or Claude, save its answers as a plain text file,
          and upload that below to prefill this form.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href="/onboarding-questionnaire.pdf"
            download
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            ⬇ Download questionnaire (PDF, fillable)
          </a>
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            ⬇ Download questions (for pasting into AI)
          </button>
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {isUploading ? "Reading your answers…" : "⬆ Upload completed file"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadCompletedFile(file);
              e.target.value = "";
            }}
          />
        </div>
        {uploadNotice && (
          <p className="mt-3 text-sm text-emerald-700">{uploadNotice}</p>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-700">{error}</p>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Section {stepIndex + 1} of {ONBOARDING_SECTIONS.length}
          </span>
          <span>{progressPct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-slate-900 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <h1 className="text-lg font-medium text-slate-900">{section.title}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Answer as thoroughly as you can. If a question doesn&apos;t apply,
        write &quot;N/A.&quot;
      </p>

      <div className="mt-6 space-y-6">
        {section.fields.map((field) => (
          <Field
            key={field.id}
            field={field}
            value={answers[field.id]}
            onChange={handleFieldChange}
          />
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          disabled={stepIndex === 0 || isPending}
          onClick={() => goToStep(stepIndex - 1)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Back
        </button>

        {isLastSection ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-5 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Submitting… this may take a minute" : "Submit"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-5 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Next"}
          </button>
        )}
      </div>
    </div>
  );
}
