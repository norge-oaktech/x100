import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAssetTemplate } from "@/config/assets";
import { generateImages } from "@/lib/openai/generateImage";
import { buildDefaultImagePrompt } from "@/lib/assets/buildImagePrompt";

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { generatedAssetId, customPrompt, count } = (await request.json()) as {
    generatedAssetId?: string;
    customPrompt?: string;
    count?: number;
  };

  if (!generatedAssetId) {
    return NextResponse.json({ error: "Missing generatedAssetId" }, { status: 400 });
  }

  const { data: asset } = await supabase
    .from("generated_assets")
    .select("id, project_id, asset_key, status")
    .eq("id", generatedAssetId)
    .maybeSingle();

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (asset.status !== "complete") {
    return NextResponse.json(
      { error: "Generate the text content for this asset first" },
      { status: 400 }
    );
  }

  const template = getAssetTemplate(asset.asset_key);
  if (!template || !template.supportsImage) {
    return NextResponse.json(
      { error: "This asset does not support image generation" },
      { status: 400 }
    );
  }

  let prompt = customPrompt?.trim();
  if (!prompt) {
    const { data: onboarding } = await supabase
      .from("onboarding_responses")
      .select("answers")
      .eq("project_id", asset.project_id)
      .maybeSingle();

    if (!onboarding) {
      return NextResponse.json(
        { error: "No onboarding answers found for this project" },
        { status: 400 }
      );
    }
    prompt = buildDefaultImagePrompt(template, onboarding.answers);
  }

  const imageCount = Math.min(Math.max(count ?? 1, 1), 4); // UI caps at 4 per batch

  try {
    const base64Images = await generateImages(
      prompt,
      imageCount,
      template.imageSize ?? "1024x1024"
    );

    const uploaded: { id: string; storagePath: string }[] = [];

    for (const b64 of base64Images) {
      const buffer = Buffer.from(b64, "base64");
      const storagePath = `${asset.project_id}/${asset.asset_key}/${crypto.randomUUID()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("asset-images")
        .upload(storagePath, buffer, { contentType: "image/png" });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      const { data: fileRow, error: insertError } = await supabase
        .from("asset_files")
        .insert({
          generated_asset_id: asset.id,
          format: "png",
          storage_path: storagePath,
        })
        .select("id")
        .single();

      if (insertError || !fileRow) {
        throw new Error(insertError?.message ?? "Could not record image file");
      }

      uploaded.push({ id: fileRow.id, storagePath });
    }

    return NextResponse.json({ success: true, count: uploaded.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
