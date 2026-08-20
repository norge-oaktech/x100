-- ============================================================================
-- Storage bucket for generated document files (currently .pptx decks;
-- future docx/pdf exports would live here too). Kept separate from
-- asset-images so image vs document buckets don't get semantically mixed.
-- Same private + team-only-read/write model as asset-images.
-- ============================================================================

alter table asset_files drop constraint if exists asset_files_format_check;
alter table asset_files add constraint asset_files_format_check
  check (format in ('docx', 'pdf', 'png', 'pptx'));

insert into storage.buckets (id, name, public)
values ('asset-documents', 'asset-documents', false)
on conflict (id) do nothing;

create policy "team can read asset-documents"
  on storage.objects for select
  using (bucket_id = 'asset-documents' and auth.role() = 'authenticated');

create policy "team can upload asset-documents"
  on storage.objects for insert
  with check (bucket_id = 'asset-documents' and auth.role() = 'authenticated');
