"use client";

import { useState, useTransition } from "react";
import { createProjectAction } from "./actions";

export function NewProjectForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setGeneratedLink(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createProjectAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      const url = `${window.location.origin}/onboard/${result.slug}`;
      setGeneratedLink(url);
      setClientName("");
      e.currentTarget?.reset();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium">New project</h2>
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          name="clientName"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Client / fund name"
          required
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create"}
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {generatedLink && (
        <div className="mt-3 rounded-md bg-slate-50 p-3">
          <p className="text-xs text-slate-500">
            Onboarding link — send this to the client:
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate text-xs">{generatedLink}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(generatedLink)}
              className="shrink-0 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-white"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
