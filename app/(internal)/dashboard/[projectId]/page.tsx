import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_SECTIONS } from "@/config/onboardingSchema";
import { notFound } from "next/navigation";
import type {
  OnboardingResponse,
  Project,
  Client,
  GeneratedAsset,
  AssetFile,
  AssetFileWithUrl,
} from "@/types/database";
import { GenerateAssetPanel } from "./GenerateAssetPanel";

const STATUS_BADGE_CLASS: Record<string, string> = {
  awaiting_onboarding: "b-draft",
  onboarding_in_progress: "b-onboarding",
  onboarding_complete: "b-onboard",
  generating: "b-generating",
  ready: "b-active",
  archived: "b-draft",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: { projectId: string };
}) {
  const supabase = createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*, clients(name)")
    .eq("id", params.projectId)
    .single<Project & { clients: Pick<Client, "name"> | null }>();

  if (!project) notFound();

  const { data: response } = await supabase
    .from("onboarding_responses")
    .select("*")
    .eq("project_id", project.id)
    .maybeSingle<OnboardingResponse>();

  const { data: generatedAssets } = await supabase
    .from("generated_assets")
    .select("*")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true })
    .returns<GeneratedAsset[]>();

  const generatedAssetIds = (generatedAssets ?? []).map((a) => a.id);

  const { data: assetFiles } = generatedAssetIds.length
    ? await supabase
        .from("asset_files")
        .select("*")
        .in("generated_asset_id", generatedAssetIds)
        .order("created_at", { ascending: true })
        .returns<AssetFile[]>()
    : { data: [] as AssetFile[] };

  // Sign every file path (1 hour expiry — regenerated on every page load,
  // so this is generous enough for a single review session). Images and
  // documents (pptx, etc.) live in separate storage buckets.
  const imagesByAssetId: Record<string, AssetFileWithUrl[]> = {};
  const documentsByAssetId: Record<string, AssetFileWithUrl[]> = {};
  for (const file of assetFiles ?? []) {
    const bucket = file.format === "png" ? "asset-images" : "asset-documents";
    const targetMap = file.format === "png" ? imagesByAssetId : documentsByAssetId;

    const { data: signed } = await supabase.storage
      .from(bucket)
      .createSignedUrl(file.storage_path, 3600);
    if (!signed) continue;
    const list = targetMap[file.generated_asset_id] ?? [];
    list.push({ ...file, url: signed.signedUrl });
    targetMap[file.generated_asset_id] = list;
  }

  const onboardingUrl = `${
    process.env.NEXT_PUBLIC_APP_URL ?? ""
  }/onboard/${project.slug}`;

  const completedCount = response?.completed_sections?.length ?? 0;
  const onboardingComplete =
    project.status !== "awaiting_onboarding" &&
    project.status !== "onboarding_in_progress";
  const progressPct = Math.round(
    (completedCount / ONBOARDING_SECTIONS.length) * 100
  );

  return (
    <main className="scroll mx-auto max-w-3xl">
      <div className="breadcrumb mb8">
        <a href="/dashboard" className="crumb-link">
          Projects
        </a>
        <span className="sep">/</span>
        <span className="current">{project.clients?.name ?? "Unnamed client"}</span>
      </div>

      <div className="fb mb16">
        <div className="page-title" style={{ marginBottom: 0 }}>
          {project.clients?.name ?? "Unnamed client"}
        </div>
        <span
          className={`badge ${STATUS_BADGE_CLASS[project.status] ?? "b-draft"}`}
        >
          {project.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="card mb20">
        <div className="section-label">Onboarding link</div>
        <code
          className="tm"
          style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}
        >
          {onboardingUrl}
        </code>
        <div style={{ marginTop: 12 }}>
          <div className="progress-row">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="progress-pct">{progressPct}%</span>
          </div>
          <p className="tf" style={{ fontSize: 11, marginTop: 6 }}>
            {completedCount} / {ONBOARDING_SECTIONS.length} sections completed
            {response?.submitted_at &&
              ` — submitted ${new Date(response.submitted_at).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      <GenerateAssetPanel
        projectId={project.id}
        onboardingComplete={onboardingComplete}
        hasOnboardingResponses={!!response}
        initialAssets={generatedAssets ?? []}
        imagesByAssetId={imagesByAssetId}
        documentsByAssetId={documentsByAssetId}
      />

      {!response ? (
        <p className="tm mt16" style={{ fontSize: 13 }}>
          Client hasn&apos;t started onboarding yet.
        </p>
      ) : (
        <div style={{ marginTop: 32 }}>
          <div className="section-label">Onboarding answers</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ONBOARDING_SECTIONS.map((section) => {
              const isDone = response.completed_sections?.includes(section.id);
              return (
                <div key={section.id} className="card-sm">
                  <div className="fb">
                    <span className="fw6" style={{ fontSize: 13 }}>
                      {section.title}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: isDone ? "var(--success)" : "var(--text-faint)",
                      }}
                    >
                      {isDone ? "Complete" : "Not started"}
                    </span>
                  </div>
                  {isDone && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {section.fields.map((field) => {
                        const value = response.answers?.[field.id];
                        if (!value || (Array.isArray(value) && value.length === 0))
                          return null;
                        return (
                          <div key={field.id}>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-faint)",
                                marginBottom: 1,
                              }}
                            >
                              {field.label}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                              {Array.isArray(value) ? value.join(", ") : value}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
