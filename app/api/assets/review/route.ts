import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ReviewAction = "approve" | "reject" | "save_edit";

// Reads APPROVER_EMAILS (comma-separated) from the environment. Empty/unset
// means "anyone signed in can approve" -- the original default. Set this in
// Vercel's Environment Variables to restrict approval to specific people;
// no code change or redeploy needed to add/remove someone, just update the
// env var and redeploy (Vercel requires a redeploy to pick up env changes,
// but the list itself lives entirely in config, not code).
function getApproverAllowlist(): string[] | null {
  const raw = process.env.APPROVER_EMAILS;
  if (!raw || raw.trim() === "") return null;
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function isApprover(email: string | undefined | null): boolean {
  const allowlist = getApproverAllowlist();
  if (!allowlist) return true; // no allowlist configured -- anyone can approve
  if (!email) return false;
  return allowlist.includes(email.toLowerCase());
}

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { assetId, action, content } = (await request.json()) as {
    assetId?: string;
    action?: ReviewAction;
    content?: string;
  };

  if (!assetId || !action) {
    return NextResponse.json(
      { error: "Missing assetId or action" },
      { status: 400 }
    );
  }

  // Only approve/reject are gated by the approver allowlist -- editing
  // content before approval is intentionally open to any team member, same
  // as generation itself.
  if ((action === "approve" || action === "reject") && !isApprover(user.email)) {
    return NextResponse.json(
      { error: "You're not on the approver list for this project." },
      { status: 403 }
    );
  }

  const { data: asset } = await supabase
    .from("generated_assets")
    .select("id, approval_status")
    .eq("id", assetId)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (action === "save_edit") {
    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing content for save_edit" },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("generated_assets")
      .update({ content })
      .eq("id", assetId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "approve" || action === "reject") {
    const { error } = await supabase
      .from("generated_assets")
      .update({
        approval_status: action === "approve" ? "approved" : "rejected",
        approved_by: user.email ?? user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", assetId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

