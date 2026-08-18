-- ============================================================================
-- Storage bucket for AI-generated images (social post visuals, teaser
-- banners, event banners). Private bucket -- the app reads images via
-- short-lived signed URLs generated server-side (project detail page,
-- using the service-role admin client), never via public URLs, so these
-- generated visuals stay behind team login like everything else generated.
-- ============================================================================

-- asset_files.format was originally constrained to docx/pdf (Phase 1 was
-- built anticipating document exports only). Extend it to allow generated
-- images too, rather than creating a separate table for the same concept.
alter table asset_files drop constraint if exists asset_files_format_check;
alter table asset_files add constraint asset_files_format_check
  check (format in ('docx', 'pdf', 'png'));

insert into storage.buckets (id, name, public)
values ('asset-images', 'asset-images', false)
on conflict (id) do nothing;

-- Authenticated team members can read/write directly if ever needed
-- client-side; the app currently does all reads/writes through the
-- service-role admin client, which bypasses these policies entirely, but
-- this keeps the bucket consistent with the rest of the schema's "team
-- only" model rather than leaving it with no policies at all.
create policy "team can read asset-images"
  on storage.objects for select
  using (bucket_id = 'asset-images' and auth.role() = 'authenticated');

create policy "team can upload asset-images"
  on storage.objects for insert
  with check (bucket_id = 'asset-images' and auth.role() = 'authenticated');
