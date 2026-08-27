-- ============================================================================
-- Supports HeyGen video generation for the 3 Phase 3C script/brief assets
-- (AI Interview Video, Short Clips, Reels). Video render is asynchronous and
-- can take several minutes -- HeyGen's own docs recommend a webhook
-- (callback_url) over polling, since polling would hold a Vercel function
-- open far past any reasonable maxDuration. The generated text itself still
-- completes normally and immediately (status stays 'complete', same as
-- every other asset) -- the video attaches later as an asset_files row once
-- app/api/webhooks/heygen/route.ts receives the callback, exactly the same
-- "best-effort secondary attachment" pattern already used for images and
-- deck/calendar files.
--
-- No new storage bucket: mp4s live in the existing asset-documents bucket
-- (already private, team-only read/write -- see 0004) since the app's file
-- -> bucket mapping is just "png goes to asset-images, everything else goes
-- to asset-documents" (see app/(internal)/dashboard/[projectId]/page.tsx).
-- ============================================================================

alter table asset_files drop constraint if exists asset_files_format_check;
alter table asset_files add constraint asset_files_format_check
  check (format in ('docx', 'pdf', 'png', 'pptx', 'xlsx', 'mp4'));

alter table generated_assets add column if not exists heygen_video_id text;
create index if not exists generated_assets_heygen_video_id_idx
  on generated_assets (heygen_video_id)
  where heygen_video_id is not null;
