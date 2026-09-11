"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function UploadAnswersButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  function handleFile(file: File) {
    setMessage(null);
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      try {
        const res = await fetch("/api/onboarding/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, text }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ text: data.error ?? "Upload failed", isError: true });
        } else {
          setMessage({
            text: `Filled in ${data.matchedFieldCount}/${data.totalFieldCount} questions — ${data.completedSectionCount}/${data.totalSectionCount} sections now complete.`,
            isError: false,
          });
          router.refresh();
        }
      } catch {
        setMessage({ text: "Upload failed — try again.", isError: true });
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      setIsUploading(false);
      setMessage({ text: "Could not read that file.", isError: true });
    };
    reader.readAsText(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button
        type="button"
        className="btn btn-primary btn-xs"
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? "Reading…" : "⬆ Upload answers"}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {message && (
        <span
          className="tf"
          style={{
            fontSize: 11,
            maxWidth: 260,
            textAlign: "right",
            color: message.isError ? "var(--danger)" : "var(--success)",
          }}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
