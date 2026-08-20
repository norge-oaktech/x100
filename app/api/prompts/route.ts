import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetTemplate } from "@/config/assets";

// Note: no approver restriction on editing prompts, same as generation
// itself — any signed-in team member can edit. If that ever needs
// restricting, this is the one place to add that check (see
// app/api/assets/review/route.ts for the equivalent allowlist pattern).

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { assetKey, clientId, systemPrompt } = (await request.json()) as {
    assetKey?: string;
    clientId?: string | null;
    systemPrompt?: string;
  };

  if (!assetKey || typeof systemPrompt !== "string" || systemPrompt.trim() === "") {
    return NextResponse.json(
      { error: "Missing assetKey or systemPrompt" },
      { status: 400 }
    );
  }

  if (!getAssetTemplate(assetKey)) {
    return NextResponse.json({ error: "Unknown asset" }, { status: 400 });
  }

  // Explicit select-then-insert/update instead of a single upsert: the two
  // partial unique indexes (general vs. client-specific) don't map cleanly
  // onto Postgrest's upsert onConflict target, so this is simpler and just
  // as safe at this scale (no meaningful concurrency on prompt editing).
  let existingQuery = supabase
    .from("prompt_overrides")
    .select("id")
    .eq("asset_key", assetKey);
  existingQuery = clientId
    ? existingQuery.eq("client_id", clientId)
    : existingQuery.is("client_id", null);

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("prompt_overrides")
      .update({
        system_prompt: systemPrompt,
        updated_by: user.email ?? user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase.from("prompt_overrides").insert({
      asset_key: assetKey,
      client_id: clientId ?? null,
      system_prompt: systemPrompt,
      updated_by: user.email ?? user.id,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { assetKey, clientId } = (await request.json()) as {
    assetKey?: string;
    clientId?: string | null;
  };

  if (!assetKey) {
    return NextResponse.json({ error: "Missing assetKey" }, { status: 400 });
  }

  let deleteQuery = supabase.from("prompt_overrides").delete().eq("asset_key", assetKey);
  deleteQuery = clientId
    ? deleteQuery.eq("client_id", clientId)
    : deleteQuery.is("client_id", null);

  const { error } = await deleteQuery;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
