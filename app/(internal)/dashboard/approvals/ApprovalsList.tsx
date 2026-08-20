"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface PendingApprovalItem {
  id: string;
  assetLabel: string;
  content: string;
  createdAt: string;
  projectId: string;
  clientName: string;
}

export function ApprovalsList({ items }: { items: PendingApprovalItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleReview(assetId: string, action: "approve" | "reject") {
    setError(null);
    setActiveId(assetId);
    startTransition(async () => {
      const res = await fetch("/api/assets/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed");
      }
      setActiveId(null);
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <div className="card-sm">
        <p className="tm" style={{ fontSize: 13 }}>
          Nothing waiting on review right now.
        </p>
      </div>
    );
  }

  return (
    <div>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          const isBusy = isPending && activeId === item.id;
          return (
            <div key={item.id} className="card-sm">
              <div className="fb">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.assetLabel}</div>
                  <div className="tf" style={{ fontSize: 11, marginTop: 2 }}>
                    {item.clientName} · {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="fac gap8">
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    {isExpanded ? "Hide" : "Preview"}
                  </button>
                  <a href={`/dashboard/${item.projectId}`} className="btn btn-ghost btn-xs">
                    Open project
                  </a>
                  <button
                    className="btn btn-success btn-xs"
                    disabled={isBusy}
                    onClick={() => handleReview(item.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-danger btn-xs"
                    disabled={isBusy}
                    onClick={() => handleReview(item.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div
                  className="output-val"
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid var(--border)",
                    maxHeight: 300,
                    overflowY: "auto",
                  }}
                >
                  {item.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
