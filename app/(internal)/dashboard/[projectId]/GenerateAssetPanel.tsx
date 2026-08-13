"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ASSET_TEMPLATES,
  allFoundationalApproved,
  isRequiredFoundational,
  type AssetTemplate,
} from "@/config/assets";
import type { GeneratedAsset } from "@/types/database";

function statusBadgeClass(status?: string) {
  switch (status) {
    case "complete":
      return "b-approved";
    case "generating":
      return "b-generating";
    case "failed":
      return "b-failed";
    default:
      return "b-draft";
  }
}

function approvalBadgeClass(status?: string) {
  switch (status) {
    case "approved":
      return "b-approved";
    case "rejected":
      return "b-failed";
    case "pending":
      return "b-review";
    default:
      return "b-draft";
  }
}

function AssetCard({
  template,
  existing,
  isGenerating,
  disabled,
  disabledReason,
  onGenerate,
  onApprove,
  onReject,
  onSaveEdit,
}: {
  template: AssetTemplate;
  existing?: GeneratedAsset;
  isGenerating: boolean;
  disabled: boolean;
  disabledReason?: string;
  onGenerate: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onSaveEdit?: (content: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(existing?.content ?? "");

  const status = isGenerating ? "generating" : existing?.status;
  const showApprovalControls =
    template.tier === "foundational" &&
    existing?.status === "complete" &&
    existing.approval_status !== "approved";
  const required = template.tier === "foundational" && isRequiredFoundational(template.id);

  return (
    <div className="receipt">
      <div className="receipt-head">
        <div className="receipt-id">
          {status === "generating" && <span className="pulse" />}
          {template.label}
          {template.tier === "foundational" && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                color: "var(--text-faint)",
                fontSize: 10.5,
                marginLeft: 2,
              }}
            >
              {required ? "· required" : "· optional"}
            </span>
          )}
        </div>
        <div className="fac gap8">
          {status && (
            <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>
          )}
          {template.tier === "foundational" && existing?.approval_status && (
            <span className={`badge ${approvalBadgeClass(existing.approval_status)}`}>
              {existing.approval_status}
            </span>
          )}
          <button
            onClick={onGenerate}
            disabled={disabled || isGenerating}
            title={disabled ? disabledReason : undefined}
            className="btn btn-primary btn-xs"
          >
            {isGenerating
              ? "Generating…"
              : existing?.status === "complete"
              ? "⚡ Regenerate"
              : "⚡ Generate"}
          </button>
        </div>
      </div>

      {disabled && disabledReason && !existing && (
        <div className="receipt-output">
          <p className="tf" style={{ fontSize: 12 }}>
            {disabledReason}
          </p>
        </div>
      )}

      {existing?.generated_at && (
        <div className="receipt-meta">
          <div>
            <div className="rmeta-label">Model</div>
            <div className="rmeta-val">{existing.model_used}</div>
          </div>
          <div>
            <div className="rmeta-label">Generated</div>
            <div className="rmeta-val">
              {new Date(existing.generated_at).toLocaleString()}
            </div>
          </div>
          {existing.approved_by && (
            <>
              <div>
                <div className="rmeta-label">Reviewed by</div>
                <div className="rmeta-val">{existing.approved_by}</div>
              </div>
              <div>
                <div className="rmeta-label">Reviewed at</div>
                <div className="rmeta-val">
                  {existing.approved_at &&
                    new Date(existing.approved_at).toLocaleString()}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {existing?.status === "complete" && existing.content && (
        <div className="receipt-output">
          {isEditing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="field-input"
              style={{ width: "100%", minHeight: 220, fontFamily: "var(--font-body)" }}
            />
          ) : (
            <div className="output-val">{existing.content}</div>
          )}
        </div>
      )}

      {existing?.status === "failed" && (
        <div className="receipt-output">
          <p style={{ fontSize: 12, color: "var(--danger)" }}>
            Failed: {existing.error}
          </p>
        </div>
      )}

      {template.tier === "foundational" && existing?.status === "complete" && (
        <div className="receipt-actions">
          {isEditing ? (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  onSaveEdit?.(draft);
                  setIsEditing(false);
                }}
              >
                Save edits
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDraft(existing.content ?? "");
                  setIsEditing(false);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          )}
          {showApprovalControls && (
            <>
              <button className="btn btn-success btn-sm" onClick={onApprove}>
                Approve
              </button>
              <button className="btn btn-danger btn-sm" onClick={onReject}>
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function GenerateAssetPanel({
  projectId,
  onboardingComplete,
  hasOnboardingResponses,
  initialAssets,
}: {
  projectId: string;
  onboardingComplete: boolean;
  hasOnboardingResponses: boolean;
  initialAssets: GeneratedAsset[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isBatchPending, setIsBatchPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assetsByKey = new Map(initialAssets.map((a) => [a.asset_key, a]));
  const foundationalTemplates = ASSET_TEMPLATES.filter((t) => t.tier === "foundational");
  const marketingTemplates = ASSET_TEMPLATES.filter((t) => t.tier === "marketing");
  const foundationalApproved = allFoundationalApproved(initialAssets);
  const anyFoundationalGenerated = foundationalTemplates.some((t) => assetsByKey.has(t.id));

  function callApi(body: Record<string, unknown>, endpoint: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
      }
      setActiveKey(null);
      router.refresh();
    });
  }

  function handleGenerate(assetKey: string) {
    setActiveKey(assetKey);
    callApi({ projectId, assetKey }, "/api/generate");
  }

  function handleGenerateAllFoundational() {
    setError(null);
    setIsBatchPending(true);
    startTransition(async () => {
      const res = await fetch("/api/generate-foundational", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) {
        setError(data.error ?? "Batch generation failed");
      } else if (res.status === 207) {
        setError(data.error); // partial failure — still refresh to show what succeeded
      }
      setIsBatchPending(false);
      router.refresh();
    });
  }

  function handleReview(
    assetId: string,
    action: "approve" | "reject" | "save_edit",
    content?: string
  ) {
    callApi({ assetId, action, content }, "/api/assets/review");
  }

  return (
    <div className="mb20">
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

      <div className="fb" style={{ marginBottom: 10 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>
          Foundational Documents — require approval
        </div>
        <button
          onClick={handleGenerateAllFoundational}
          disabled={!hasOnboardingResponses || isBatchPending || isPending}
          title={
            !hasOnboardingResponses
              ? "Client hasn't started onboarding yet"
              : undefined
          }
          className="btn btn-primary btn-xs"
        >
          {isBatchPending
            ? "Generating all…"
            : anyFoundationalGenerated
            ? "⚡ Regenerate all"
            : "⚡ Generate all foundational"}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
        {foundationalTemplates.map((template) => {
          const existing = assetsByKey.get(template.id);
          const isGeneratingThis =
            (isPending && activeKey === template.id) || isBatchPending;
          return (
            <AssetCard
              key={template.id}
              template={template}
              existing={existing}
              isGenerating={isGeneratingThis}
              disabled={!hasOnboardingResponses}
              disabledReason="Client hasn't started onboarding yet — nothing to generate from."
              onGenerate={() => handleGenerate(template.id)}
              onApprove={() => existing && handleReview(existing.id, "approve")}
              onReject={() => existing && handleReview(existing.id, "reject")}
              onSaveEdit={(content) => existing && handleReview(existing.id, "save_edit", content)}
            />
          );
        })}
      </div>

      <div className="fb" style={{ marginBottom: 10 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>
          Marketing Assets
        </div>
        {!foundationalApproved && (
          <span className="tf" style={{ fontSize: 11.5 }}>
            Locked until the 4 required foundational documents are approved
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {marketingTemplates.map((template) => {
          const existing = assetsByKey.get(template.id);
          const isGeneratingThis = isPending && activeKey === template.id;
          const locked = !onboardingComplete || !foundationalApproved;
          return (
            <AssetCard
              key={template.id}
              template={template}
              existing={existing}
              isGenerating={isGeneratingThis}
              disabled={locked}
              disabledReason={
                !onboardingComplete
                  ? "Onboarding must be complete before this can be generated."
                  : "Locked until the 4 required foundational documents are approved."
              }
              onGenerate={() => handleGenerate(template.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
