"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ASSET_TEMPLATES,
  allFoundationalApproved,
  isRequiredFoundational,
  MARKETING_PHASES,
  type AssetTemplate,
} from "@/config/assets";
import type { GeneratedAsset, AssetFileWithUrl } from "@/types/database";

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

function ImageSubsection({
  images,
  isGenerating,
  onGenerateImages,
}: {
  images: AssetFileWithUrl[];
  isGenerating: boolean;
  onGenerateImages: (customPrompt: string, count: number) => void;
}) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [count, setCount] = useState(1);

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        padding: "14px 16px",
        background: "var(--bg-surface)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 8 }}>
        IMAGES
      </div>

      {images.length === 0 && (
        <p className="tf" style={{ fontSize: 11.5, marginBottom: 10 }}>
          No image yet — generate below, or click Regenerate on the card
          above to also refresh the text.
        </p>
      )}

      {images.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          {images.map((img) => (
            <div key={img.id}>
              <img
                src={img.url}
                alt=""
                style={{
                  width: "100%",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border-light)",
                  display: "block",
                }}
              />
              <a
                href={img.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-xs"
                style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
              >
                Download
              </a>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={customPrompt}
        onChange={(e) => setCustomPrompt(e.target.value)}
        placeholder="Want something different? Describe the change (optional) — e.g. 'more blue tones' or 'simpler composition' — then generate. New images are added to the gallery, older ones aren't lost (up to 10, then the oldest are removed)."
        className="field-input"
        style={{ width: "100%", minHeight: 60, marginBottom: 8 }}
      />

      <div className="fb">
        <div className="fac gap8">
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Count:</span>
          {[1, 2, 4].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className={`btn btn-xs ${count === n ? "btn-primary" : "btn-ghost"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary btn-xs"
          disabled={isGenerating}
          onClick={() => onGenerateImages(customPrompt, count)}
        >
          {isGenerating ? "Generating…" : "⚡ Generate more"}
        </button>
      </div>
    </div>
  );
}

function DeckPreview({ content }: { content: string }) {
  try {
    const deck = JSON.parse(content) as {
      slides: { title: string; kind?: string; subtitle?: string; bullets?: string[]; notes?: string }[];
    };
    if (!Array.isArray(deck.slides) || deck.slides.length === 0) throw new Error("empty");

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {deck.slides.map((slide, i) => (
          <div
            key={i}
            className="card-sm"
            style={{ background: slide.kind === "cover" ? "var(--bg-surface-high)" : undefined }}
          >
            <div className="tf" style={{ fontSize: 10.5, marginBottom: 3 }}>
              SLIDE {i + 1}
              {slide.kind === "cover" ? " · COVER" : ""}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {slide.title}
            </div>
            {slide.subtitle && (
              <div className="tm" style={{ fontSize: 12.5, marginTop: 2, fontStyle: "italic" }}>
                {slide.subtitle}
              </div>
            )}
            {slide.bullets && slide.bullets.length > 0 && (
              <ul style={{ marginTop: 6, paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)" }}>
                {slide.bullets.map((b, bi) => (
                  <li key={bi}>{b}</li>
                ))}
              </ul>
            )}
            {slide.notes && (
              <div
                className="tf"
                style={{ fontSize: 11, marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)" }}
              >
                Speaker notes: {slide.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  } catch {
    // Fall back to raw text if the JSON didn't parse for any reason —
    // still readable, just not the nicer slide-card view.
    return <div className="output-val">{content}</div>;
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
  images,
  isImageGenerating,
  onGenerateImages,
  documents,
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
  images?: AssetFileWithUrl[];
  isImageGenerating?: boolean;
  onGenerateImages?: (customPrompt: string, count: number) => void;
  documents?: AssetFileWithUrl[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(existing?.content ?? "");
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!existing?.content) return;
    navigator.clipboard.writeText(existing.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
          {template.supportsImage && (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                color: "var(--text-faint)",
                fontSize: 10.5,
                marginLeft: 2,
              }}
            >
              · includes image
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
          ) : template.supportsDeckFile ? (
            <DeckPreview content={existing.content} />
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

      {existing?.status === "complete" && existing.content && (
        <div className="receipt-actions">
          <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>

          {template.supportsDeckFile && documents && documents.length > 0 && (
            <a
              href={documents[documents.length - 1].url}
              download
              className="btn btn-primary btn-sm"
            >
              ⬇ Download deck (.pptx)
            </a>
          )}
          {template.supportsDeckFile && (!documents || documents.length === 0) && (
            <span className="tf" style={{ fontSize: 11.5 }}>
              Building .pptx file… refresh in a moment if this doesn't appear
            </span>
          )}

          {template.tier === "foundational" && (
            <>
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
            </>
          )}
        </div>
      )}

      {template.supportsImage && existing?.status === "complete" && onGenerateImages && (
        <ImageSubsection
          images={images ?? []}
          isGenerating={!!isImageGenerating}
          onGenerateImages={onGenerateImages}
        />
      )}
    </div>
  );
}

export function GenerateAssetPanel({
  projectId,
  onboardingComplete,
  hasOnboardingResponses,
  initialAssets,
  imagesByAssetId,
  documentsByAssetId,
  section = "both",
}: {
  projectId: string;
  onboardingComplete: boolean;
  hasOnboardingResponses: boolean;
  initialAssets: GeneratedAsset[];
  imagesByAssetId: Record<string, AssetFileWithUrl[]>;
  documentsByAssetId: Record<string, AssetFileWithUrl[]>;
  // Lets callers render just the foundational block or just the marketing
  // block (e.g. from separate tabs) instead of both stacked together.
  // Defaults to "both" so any existing usage is unaffected.
  section?: "foundational" | "marketing" | "both";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isBatchPending, setIsBatchPending] = useState(false);
  const [activeImageAssetId, setActiveImageAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assetsByKey = new Map(initialAssets.map((a) => [a.asset_key, a]));
  const foundationalTemplates = ASSET_TEMPLATES.filter((t) => t.tier === "foundational");
  const marketingTemplates = ASSET_TEMPLATES.filter((t) => t.tier === "marketing");
  const foundationalApproved = allFoundationalApproved(initialAssets);
  const anyFoundationalGenerated = foundationalTemplates.some((t) => assetsByKey.has(t.id));

  // Only include phases that actually have assets defined (3b/3c are empty
  // until those phases are built).
  const phaseGroups = MARKETING_PHASES.map((phase) => ({
    phase,
    templates: marketingTemplates.filter((t) => t.phase === phase.code),
  })).filter((g) => g.templates.length > 0);

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
      setActiveImageAssetId(null);
      router.refresh();
    });
  }

  function handleGenerate(assetKey: string) {
    setActiveKey(assetKey);
    callApi({ projectId, assetKey }, "/api/generate");
  }

  function handleGenerateImages(generatedAssetId: string, customPrompt: string, count: number) {
    setActiveImageAssetId(generatedAssetId);
    callApi(
      { generatedAssetId, customPrompt: customPrompt.trim() || undefined, count },
      "/api/generate-image"
    );
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

  const locked = !onboardingComplete || !foundationalApproved;
  const [showLockedDetails, setShowLockedDetails] = useState(false);

  const requiredApprovedCount = foundationalTemplates.filter(
    (t) => isRequiredFoundational(t.id) && assetsByKey.get(t.id)?.approval_status === "approved"
  ).length;
  const requiredTotal = foundationalTemplates.filter((t) => isRequiredFoundational(t.id)).length;

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

      {/* ── Step 1: Foundational Documents ───────────────────────── */}
      {(section === "foundational" || section === "both") && (
      <div className="section-block">
        <div className="section-block-header">
          <span className="step-num">1</span>
          <div style={{ flex: 1 }}>
            <div className="section-block-title">Foundational Documents</div>
            <div className="section-block-sub">
              Require approval · {requiredApprovedCount}/{requiredTotal} required approved
            </div>
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
        <div className="section-block-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        </div>
      </div>
      )}

      {/* ── Step 2: Marketing Assets ─────────────────────────────── */}
      {(section === "marketing" || section === "both") && (
      <div className="section-block">
        <div className={`section-block-header${locked ? " locked" : ""}`}>
          <span className={`step-num${locked ? " dimmed" : ""}`}>2</span>
          <div style={{ flex: 1 }}>
            <div className="section-block-title">Marketing Assets</div>
            <div className="section-block-sub">
              {locked
                ? !onboardingComplete
                  ? "Locked — onboarding not yet complete"
                  : "Locked — waiting on required foundational approvals"
                : `${marketingTemplates.length} assets unlocked across ${phaseGroups.length} phases`}
            </div>
          </div>
          {locked && <span className="badge b-draft">Locked</span>}
        </div>

        {locked ? (
          <div className="section-block-body">
            <div className="locked-summary">
              <span className="locked-summary-text">
                {marketingTemplates.length} marketing assets across{" "}
                {phaseGroups.length} phases (fundraising &amp; legal docs,
                website, social, and more) will unlock once all{" "}
                {requiredTotal} required foundational documents above are
                approved.
              </span>
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => setShowLockedDetails((v) => !v)}
              >
                {showLockedDetails ? "Hide list" : "Show list"}
              </button>
            </div>
            {showLockedDetails && (
              <div style={{ marginTop: 14 }}>
                {phaseGroups.map(({ phase, templates }) => (
                  <div key={phase.code} style={{ marginBottom: 20 }}>
                    <div className="section-label">{phase.label}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {templates.map((template) => {
                        const existing = assetsByKey.get(template.id);
                        return (
                          <AssetCard
                            key={template.id}
                            template={template}
                            existing={existing}
                            isGenerating={false}
                            disabled={true}
                            disabledReason={
                              !onboardingComplete
                                ? "Onboarding must be complete before this can be generated."
                                : "Locked until the required foundational documents are approved."
                            }
                            onGenerate={() => handleGenerate(template.id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="section-block-body">
            {phaseGroups.map(({ phase, templates }, i) => (
              <div key={phase.code} style={{ marginBottom: i === phaseGroups.length - 1 ? 0 : 20 }}>
                <div className="section-label">{phase.label}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {templates.map((template) => {
                    const existing = assetsByKey.get(template.id);
                    const isGeneratingThis = isPending && activeKey === template.id;
                    const isImageGeneratingThis =
                      isPending && !!existing && activeImageAssetId === existing.id;
                    return (
                      <AssetCard
                        key={template.id}
                        template={template}
                        existing={existing}
                        isGenerating={isGeneratingThis}
                        disabled={false}
                        onGenerate={() => handleGenerate(template.id)}
                        images={existing ? imagesByAssetId[existing.id] : undefined}
                        documents={existing ? documentsByAssetId[existing.id] : undefined}
                        isImageGenerating={isImageGeneratingThis}
                        onGenerateImages={
                          existing
                            ? (customPrompt, count) =>
                                handleGenerateImages(existing.id, customPrompt, count)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
