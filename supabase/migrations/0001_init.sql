-- ============================================================================
-- Copy Generator — initial schema (Phase 1: onboarding only)
-- generated_assets / asset_files are included now so Phase 2+ doesn't need a
-- migration that reshapes existing tables, but nothing writes to them yet.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- clients: the business/fund this project is for
-- ----------------------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- projects: one onboarding + asset-generation engagement
-- ----------------------------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  slug text not null unique,
  status text not null default 'awaiting_onboarding'
    check (status in (
      'awaiting_onboarding',
      'onboarding_in_progress',
      'onboarding_complete',
      'generating',
      'ready',
      'archived'
    )),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_slug_idx on projects (slug);
create index projects_client_id_idx on projects (client_id);

-- ----------------------------------------------------------------------------
-- onboarding_responses: one row per project, answers keyed by field id from
-- config/onboardingSchema.ts. completed_sections tracks wizard progress for
-- the multi-step autosave flow.
-- ----------------------------------------------------------------------------
create table onboarding_responses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references projects(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  completed_sections text[] not null default '{}',
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index onboarding_responses_project_id_idx on onboarding_responses (project_id);

-- ----------------------------------------------------------------------------
-- generated_assets / asset_files: Phase 2+ (not written to yet, table exists
-- now so Phase 2 is additive, not a migration that touches Phase 1 tables)
-- ----------------------------------------------------------------------------
create table generated_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  asset_key text not null, -- matches AssetTemplate.id in config/assets.ts
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'complete', 'failed')),
  content text,
  model_used text,
  prompt_snapshot text,
  error text,
  generated_at timestamptz,
  created_at timestamptz not null default now()
);

create index generated_assets_project_id_idx on generated_assets (project_id);

create table asset_files (
  id uuid primary key default gen_random_uuid(),
  generated_asset_id uuid not null references generated_assets(id) on delete cascade,
  format text not null check (format in ('docx', 'pdf')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index asset_files_generated_asset_id_idx on asset_files (generated_asset_id);

-- ============================================================================
-- Row Level Security
--
-- Model: every table here is INTERNAL. Only authenticated team members
-- (rows in auth.users, i.e. people who logged into /login) can read or write
-- clients/projects/generated_assets/asset_files directly through the
-- Supabase client SDK under RLS.
--
-- The public onboarding form does NOT get its own RLS policy for writes.
-- It goes through a Next.js server action using the service-role key
-- (lib/supabase/admin.ts), which bypasses RLS entirely but is scoped in
-- application code to (a) only the project matching the slug in the URL,
-- (b) only onboarding_responses, (c) only while status is onboarding-eligible.
-- This is intentional: RLS protects the internal tables from ANY unauthenticated
-- access, and the narrow, audited server action is the only path in for
-- anonymous clients. This also satisfies "clients must never see generated
-- assets" — there is no policy anywhere that grants anon/public read access to
-- generated_assets or asset_files.
-- ============================================================================

alter table clients enable row level security;
alter table projects enable row level security;
alter table onboarding_responses enable row level security;
alter table generated_assets enable row level security;
alter table asset_files enable row level security;

create policy "team can read clients" on clients
  for select using (auth.role() = 'authenticated');
create policy "team can write clients" on clients
  for insert with check (auth.role() = 'authenticated');
create policy "team can update clients" on clients
  for update using (auth.role() = 'authenticated');

create policy "team can read projects" on projects
  for select using (auth.role() = 'authenticated');
create policy "team can write projects" on projects
  for insert with check (auth.role() = 'authenticated');
create policy "team can update projects" on projects
  for update using (auth.role() = 'authenticated');

create policy "team can read onboarding_responses" on onboarding_responses
  for select using (auth.role() = 'authenticated');
-- No insert/update policy for anon/authenticated here on purpose — all writes
-- to this table happen via the service-role admin client in the server
-- action, which bypasses RLS. Team members read-only through the dashboard.

create policy "team can read generated_assets" on generated_assets
  for select using (auth.role() = 'authenticated');
create policy "team can write generated_assets" on generated_assets
  for insert with check (auth.role() = 'authenticated');
create policy "team can update generated_assets" on generated_assets
  for update using (auth.role() = 'authenticated');

create policy "team can read asset_files" on asset_files
  for select using (auth.role() = 'authenticated');
create policy "team can write asset_files" on asset_files
  for insert with check (auth.role() = 'authenticated');
