// Hand-written to match supabase/migrations/0001_init.sql.
// Once you have a live Supabase project, prefer generating this via:
//   npx supabase gen types typescript --project-id <ref> > types/database.ts
// and re-point imports — the shapes below are deliberately the same so that
// swap is a no-op for the rest of the app.

export type ProjectStatus =
  | "awaiting_onboarding"
  | "onboarding_in_progress"
  | "onboarding_complete"
  | "generating"
  | "ready"
  | "archived";

export interface Client {
  id: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  slug: string;
  status: ProjectStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingResponse {
  id: string;
  project_id: string;
  answers: Record<string, string | string[]>;
  completed_sections: string[];
  submitted_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface GeneratedAsset {
  id: string;
  project_id: string;
  asset_key: string;
  status: "pending" | "generating" | "complete" | "failed";
  content: string | null;
  model_used: string | null;
  prompt_snapshot: string | null;
  error: string | null;
  generated_at: string | null;
  created_at: string;
}
