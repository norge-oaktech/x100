import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Deleting a client is destructive and cascades through everything it
// owns: projects -> onboarding_responses, generated_assets -> asset_files,
// plus any client-specific prompt_overrides (all via "on delete cascade"
// foreign keys, see supabase/migrations). What FK cascades do NOT reach is
// the actual files sitting in Supabase Storage (images, pptx decks) --
// deleting an asset_files row only removes the pointer, not the blob. So
// this route explicitly removes those Storage objects first, then lets the
// client delete cascade clean up every database row in one operation.
export async function DELETE(
  request: Request,
  { params }: { params: { clientId: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const clientId = params.clientId;

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", clientId);
  const projectIds = (projects ?? []).map((p) => p.id);

  if (projectIds.length > 0) {
    const { data: generatedAssets } = await supabase
      .from("generated_assets")
      .select("id")
      .in("project_id", projectIds);
    const generatedAssetIds = (generatedAssets ?? []).map((a) => a.id);

    if (generatedAssetIds.length > 0) {
      const { data: files } = await supabase
        .from("asset_files")
        .select("storage_path, format")
        .in("generated_asset_id", generatedAssetIds);

      const imagePaths = (files ?? [])
        .filter((f) => f.format === "png")
        .map((f) => f.storage_path);
      const documentPaths = (files ?? [])
        .filter((f) => f.format !== "png")
        .map((f) => f.storage_path);

      if (imagePaths.length > 0) {
        await supabase.storage.from("asset-images").remove(imagePaths);
      }
      if (documentPaths.length > 0) {
        await supabase.storage.from("asset-documents").remove(documentPaths);
      }
    }
  }

  const { error } = await supabase.from("clients").delete().eq("id", clientId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
