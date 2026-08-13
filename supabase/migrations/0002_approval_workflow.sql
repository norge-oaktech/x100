-- ============================================================================
-- Approval workflow for foundational documents (ICP, Brand Identity, Brand
-- Guidelines, Messaging Framework, Case Studies, DDQ Drafting).
--
-- These six are generated first and require approval before the rest of the
-- project's marketing assets can be generated. Approval is enforced in
-- application code (app/api/generate/route.ts), not RLS — RLS already
-- allows any authenticated team member to update generated_assets, which
-- matches "anyone can approve for now." When approver restriction by email
-- is added later, that check also belongs in the API route.
-- ============================================================================

alter table generated_assets
  add column approval_status text not null default 'not_required'
    check (approval_status in ('not_required', 'pending', 'approved', 'rejected')),
  add column approved_by text,
  add column approved_at timestamptz;

comment on column generated_assets.approval_status is
  'not_required = marketing assets (no approval gate). pending/approved/rejected = foundational documents.';
