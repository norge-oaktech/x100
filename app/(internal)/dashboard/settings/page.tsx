function getApproverList(): string[] | null {
  const raw = process.env.APPROVER_EMAILS;
  if (!raw || raw.trim() === "") return null;
  return raw.split(",").map((e) => e.trim()).filter(Boolean);
}

export default function SettingsPage() {
  const approvers = getApproverList();

  return (
    <main className="scroll mx-auto max-w-3xl">
      <div className="page-title">Settings</div>
      <div className="page-sub">Current configuration for this deployment</div>

      <div className="card mb20">
        <div className="section-label">Approvers</div>
        {approvers ? (
          <>
            <p className="tm" style={{ fontSize: 13, marginBottom: 8 }}>
              Only these team members can approve or reject foundational documents:
            </p>
            <ul style={{ paddingLeft: 18, fontSize: 13, color: "var(--text-secondary)" }}>
              {approvers.map((email) => (
                <li key={email}>{email}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="tm" style={{ fontSize: 13 }}>
            No approver list configured — any signed-in team member can
            currently approve or reject.
          </p>
        )}
        <p className="tf" style={{ fontSize: 11.5, marginTop: 10 }}>
          Set via the <code>APPROVER_EMAILS</code> environment variable
          (comma-separated) in Vercel → Settings → Environment Variables.
          Requires a redeploy to take effect.
        </p>
      </div>

      <div className="card">
        <div className="section-label">About this deployment</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
          <div className="fb">
            <span className="tm">Text generation</span>
            <span className="tc">Claude Sonnet 5 (Anthropic)</span>
          </div>
          <div className="fb">
            <span className="tm">Image generation</span>
            <span className="tc">gpt-image-1 (OpenAI)</span>
          </div>
          <div className="fb">
            <span className="tm">Database & auth</span>
            <span className="tc">Supabase</span>
          </div>
          <div className="fb">
            <span className="tm">Hosting</span>
            <span className="tc">Vercel</span>
          </div>
        </div>
      </div>
    </main>
  );
}
