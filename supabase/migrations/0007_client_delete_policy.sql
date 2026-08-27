-- ============================================================================
-- Fixes a gap from 0001_init.sql: clients got read/insert/update RLS
-- policies but no delete policy. With RLS enabled and no matching policy,
-- Postgres silently blocks the delete (0 rows affected, no error raised) --
-- it does NOT fail loudly, so app/api/clients/[clientId]/route.ts's
-- `if (error)` check never caught it. The route would report success, the
-- client row was simply never removed, and it reappeared on refresh.
--
-- No equivalent policy is needed on projects/generated_assets/asset_files/
-- onboarding_responses for this to work: their "on delete cascade" foreign
-- keys (see 0001_init.sql) run as an internal system action when the
-- parent client row is deleted, not as a user-issued DML statement, so
-- those cascades are not subject to RLS on the child tables.
-- ============================================================================

create policy "team can delete clients" on clients
  for delete using (auth.role() = 'authenticated');
