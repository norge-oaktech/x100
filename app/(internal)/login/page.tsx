"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg,#5B7FFF 0%,#A78BFA 100%)",
              fontFamily: "var(--font-display)",
            }}
          >
            x
          </div>
          <div>
            <div
              className="text-sm font-semibold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              x100
            </div>
            <div
              className="text-[9.5px] uppercase tracking-wide"
              style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}
            >
              Team access
            </div>
          </div>
        </div>

        <div className="card">
          <p className="page-title" style={{ fontSize: 16, marginBottom: 4 }}>
            Sign in
          </p>
          <p className="tm mb16" style={{ fontSize: 12.5 }}>
            Internal access only. Enter your work email — we&apos;ll send a
            sign-in link.
          </p>

          {status === "sent" ? (
            <div
              className="card-sm"
              style={{
                background: "rgba(52,211,153,0.06)",
                borderColor: "rgba(52,211,153,0.25)",
                color: "var(--success)",
                fontSize: 12.5,
              }}
            >
              Check your inbox for a sign-in link.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="field" style={{ marginBottom: 12 }}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="field-input"
                />
              </div>
              <button
                type="submit"
                disabled={status === "sending"}
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
              >
                {status === "sending" ? "Sending…" : "Send sign-in link"}
              </button>
              {status === "error" && (
                <p style={{ color: "var(--danger)", fontSize: 12.5 }}>
                  Something went wrong. Try again.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
