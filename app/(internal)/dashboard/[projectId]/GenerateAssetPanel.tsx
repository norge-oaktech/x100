"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ASSET_TEMPLATES } from "@/config/assets";
import type { GeneratedAsset } from "@/types/database";

export function GenerateAssetPanel({
  projectId,
  onboardingComplete,
  initialAssets,
}: {
  projectId: string;
  onboardingComplete: boolean;
  initialAssets: GeneratedAsset[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assetsByKey = new Map(initialAssets.map((a) => [a.asset_key, a]));

  function handleGenerate(assetKey: string) {
    setError(null);
    setActiveKey(assetKey);
    startTransition(async () => {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, assetKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Generation failed");
      }
      setActiveKey(null);
      router.refresh();
    });
  }

  return (
    <div className="mt-8">
      <h2 className="text-sm font-medium">Assets</h2>

      {!onboardingComplete && (
        <p className="mt-2 text-sm text-slate-500">
          Onboarding must be complete before generating assets.
        </p>
      )}

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 space-y-3">
        {ASSET_TEMPLATES.map((template) => {
          const existing = assetsByKey.get(template.id);
          const isGeneratingThis = isPending && activeKey === template.id;

          return (
            <div
              key={template.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{template.label}</p>
                  {existing?.generated_at && (
                    <p className="text-xs text-slate-500">
                      Last generated{" "}
                      {new Date(existing.generated_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleGenerate(template.id)}
                  disabled={!onboardingComplete || isPending}
                  className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700 disabled:opacity-40"
                >
                  {isGeneratingThis
                    ? "Generating…"
                    : existing?.status === "complete"
                    ? "Regenerate"
                    : "Generate"}
                </button>
              </div>

              {existing?.status === "complete" && existing.content && (
                <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm text-slate-800">
                  {existing.content}
                </pre>
              )}

              {existing?.status === "failed" && (
                <p className="mt-2 text-xs text-red-600">
                  Failed: {existing.error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
