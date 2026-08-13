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
    <div className="card-sm">
      <form onSubmit={handleSubmit} className="field-row" style={{ display: "flex", gap: 8 }}>
        <input
          name="clientName"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="Client / fund name"
          required
          className="field-input"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
          {isPending ? "Creating…" : "Create"}
        </button>
      </form>

      {error && (
        <p style={{ marginTop: 8, fontSize: 12.5, color: "var(--danger)" }}>{error}</p>
      )}

      {generatedLink && (
        <div
          className="card-sm"
          style={{ marginTop: 10, background: "var(--bg-surface-raised)" }}
        >
          <p style={{ fontSize: 11, color: "var(--text-faint)" }}>
            Onboarding link — send this to the client:
          </p>
          <div className="fac gap8" style={{ marginTop: 4 }}>
            <code
              className="tm"
              style={{
                flex: 1,
                fontSize: 11.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-mono)",
              }}
            >
              {generatedLink}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(generatedLink)}
              className="btn btn-ghost btn-xs"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
