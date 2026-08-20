-- ============================================================================
-- Prompt Library: lets the team edit an asset's system prompt from the UI
-- instead of code + redeploy. Two scopes per asset:
--   - General override (client_id is null) — applies to every client unless
--     a client-specific override exists for that asset.
--   - Client-specific override — takes precedence over the general
--     override for that one client's projects.
-- If neither exists, generation falls back to the hardcoded default in
-- config/assets.ts, same as before this feature existed.
-- ============================================================================

create table prompt_overrides (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null,
  client_id uuid references clients(id) on delete cascade, -- null = general
  system_prompt text not null,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prompt_overrides_asset_key_idx on prompt_overrides (asset_key);
create index prompt_overrides_client_id_idx on prompt_overrides (client_id);

-- At most one general override per asset...
create unique index prompt_overrides_general_uidx
  on prompt_overrides (asset_key)
  where client_id is null;

-- ...and at most one override per asset per client.
create unique index prompt_overrides_client_uidx
  on prompt_overrides (asset_key, client_id)
  where client_id is not null;

alter table prompt_overrides enable row level security;

create policy "team can read prompt_overrides" on prompt_overrides
  for select using (auth.role() = 'authenticated');
create policy "team can insert prompt_overrides" on prompt_overrides
  for insert with check (auth.role() = 'authenticated');
create policy "team can update prompt_overrides" on prompt_overrides
  for update using (auth.role() = 'authenticated');
create policy "team can delete prompt_overrides" on prompt_overrides
  for delete using (auth.role() = 'authenticated');
