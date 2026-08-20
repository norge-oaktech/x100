"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteClientButton({
  clientId,
  clientName,
  projectCount,
  redirectTo,
  className = "btn btn-danger btn-xs",
  label = "Delete client",
}: {
  clientId: string;
  clientName: string;
  projectCount: number;
  // If provided, navigates here after a successful delete instead of just
  // refreshing the current page (used on the client detail page, since
  // that page 404s once the client it's showing no longer exists).
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const projectWarning =
      projectCount > 0
        ? ` This permanently deletes ${projectCount} project${
            projectCount === 1 ? "" : "s"
          }, all onboarding data, generated assets, and files.`
        : "";
    const confirmed = window.confirm(
      `Delete ${clientName}?${projectWarning} This cannot be undone.`
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Delete failed");
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <>
      <button className={className} disabled={isPending} onClick={handleDelete}>
        {isPending ? "Deleting…" : label}
      </button>
      {error && (
        <span style={{ color: "var(--danger)", fontSize: 11, marginLeft: 8 }}>
          {error}
        </span>
      )}
    </>
  );
}
