"use client";

import { buildQuestionnaireMarkdown } from "@/lib/onboarding/questionnaireMarkdown";

export function DownloadQuestionsButton() {
  function handleDownload() {
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

  return (
    <button type="button" className="btn btn-ghost btn-xs" onClick={handleDownload}>
      ⬇ Download questions (MD)
    </button>
  );
}
