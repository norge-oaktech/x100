"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";

export interface PromptLibraryAsset {
  id: string;
  label: string;
  category: string;
  phase?: string;
  tier: "foundational" | "marketing";
  defaultSystemPrompt: string;
}

export interface OverrideInfo {
  systemPrompt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export function PromptLibraryList({
  assets,
  clients,
  selectedClientId,
  generalOverrides,
  clientOverrides,
}: {
  assets: PromptLibraryAsset[];
  clients: { id: string; name: string }[];
  selectedClientId: string | null;
  generalOverrides: Record<string, OverrideInfo>;
  clientOverrides: Record<string, OverrideInfo>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const scope: "general" | "client" = selectedClientId ? "client" : "general";
  const overridesForScope = scope === "client" ? clientOverrides : generalOverrides;

  function handleClientChange(value: string) {
    router.push(value ? `/dashboard/prompt-library?client=${value}` : "/dashboard/prompt-library");
  }

  function startEditing(asset: PromptLibraryAsset) {
    const override = overridesForScope[asset.id];
    setDraft(override?.systemPrompt ?? asset.defaultSystemPrompt);
    setExpandedId(asset.id);
    setError(null);
  }

  function handleSave(assetKey: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetKey,
          clientId: selectedClientId,
          systemPrompt: draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      setExpandedId(null);
      router.refresh();
    });
  }

  function handleReset(assetKey: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/prompts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetKey, clientId: selectedClientId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
        return;
      }
      setExpandedId(null);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="fb mb16">
        <div className="fac gap8">
          <span className="tm" style={{ fontSize: 12.5 }}>
            Scope:
          </span>
          <select
            className="field-input"
            style={{ width: 260 }}
            value={selectedClientId ?? ""}
            onChange={(e) => handleClientChange(e.target.value)}
          >
            <option value="">General (all clients)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (client-specific)
              </option>
            ))}
          </select>
        </div>
        {scope === "client" && (
          <span className="tf" style={{ fontSize: 11.5 }}>
            Client-specific overrides take priority over the general prompt for this client&apos;s projects.
          </span>
        )}
      </div>

      {error && (
        <div
          className="card-sm mb12"
          style={{
            background: "rgba(248,113,113,0.06)",
            borderColor: "rgba(248,113,113,0.25)",
            color: "var(--danger)",
            fontSize: 12.5,
          }}
        >
          {error}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prompt</th>
              <th>Category</th>
              <th>Phase</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const override = overridesForScope[asset.id];
              const isExpanded = expandedId === asset.id;
              return (
                <Fragment key={asset.id}>
                  <tr>
                    <td className="tc">{asset.label}</td>
                    <td className="tm" style={{ textTransform: "capitalize" }}>
                      {asset.category.replace(/_/g, " ")}
                    </td>
                    <td className="tm">{asset.phase ? asset.phase.toUpperCase() : "—"}</td>
                    <td>
                      <span className={`badge ${override ? "b-generating" : "b-draft"}`}>
                        {override ? "Custom" : "Default"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() =>
                          isExpanded ? setExpandedId(null) : startEditing(asset)
                        }
                      >
                        {isExpanded ? "Close" : "Edit"}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} style={{ background: "var(--bg-surface-raised)" }}>
                        <div style={{ padding: "12px 4px" }}>
                          {override && (
                            <p className="tf" style={{ fontSize: 11, marginBottom: 8 }}>
                              Last edited by {override.updatedBy ?? "unknown"} on{" "}
                              {new Date(override.updatedAt).toLocaleString()}
                            </p>
                          )}
                          <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            className="field-input"
                            style={{
                              width: "100%",
                              minHeight: 260,
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                            }}
                          />
                          <div className="fb" style={{ marginTop: 10 }}>
                            <div className="fac gap8">
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={isPending}
                                onClick={() => handleSave(asset.id)}
                              >
                                {isPending ? "Saving…" : "Save"}
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setExpandedId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                            {override && (
                              <button
                                className="btn btn-danger btn-sm"
                                disabled={isPending}
                                onClick={() => handleReset(asset.id)}
                              >
                                Reset to default
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
