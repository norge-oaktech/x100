-- ============================================================================
-- Extends asset_files to allow the xlsx format (monthly content calendar).
-- Uses the same asset-documents bucket created in 0004 -- no new bucket
-- needed, just a wider format constraint.
-- ============================================================================

alter table asset_files drop constraint if exists asset_files_format_check;
alter table asset_files add constraint asset_files_format_check
  check (format in ('docx', 'pdf', 'png', 'pptx', 'xlsx'));
