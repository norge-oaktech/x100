# x100 — Phase 1 + Phase 2 (Onboarding + first generated asset)

Data-driven copy-generation app. This delivery covers **Phases 1–2**:
client onboarding intake, plus generation for one asset end-to-end (Cold
Outreach Email — Investor Introduction) to validate the pipeline before
scaling to the full 8-asset prototype set. File export (docx/pdf) is
Phase 3/4 — generated copy currently displays as text on the internal
dashboard only.

## Phase 2 additions

- `config/assets.ts` — the data-driven asset template registry, now built
  from your real prompt materials (12 assets: Cold Outreach Email, 6
  website pages, Investor Landing Page, Investor Teaser, Pitch Deck, 2
  Event Presentation variants, Executive Briefing). This **replaces** the
  earlier 8-asset placeholder list.
- `config/knowledgeBase.ts` — shared helper that serializes every answered
  onboarding field into a "FUND KNOWLEDGE BASE" block, grouped by section.
  Every asset's prompt gets this fresh on each generation call, rather than
  each asset hand-picking specific fields — this is what lets long-form
  assets (website pages, decks) draw on the full intake without a bespoke
  field list per asset.
- **Known gap:** the Executive Briefing asset was drafted from a structural
  outline only — the source document you sent didn't contain actual prompt
  instructions (just a table of contents). Treat its output as a first
  draft needing more review than the others until you send the real prompt.
- **Landing Page naming:** built as a single asset for now — the "FI / FR"
  distinction in your source filename wasn't resolved yet. Trivial to split
  into two variants once clarified, since it's just another config entry.
- Decks (Pitch Deck, both Event Presentations) are marked `outputFormat:
  "pptx"` in the config for when file export is built — right now, like
  everything else in Phase 2, they only display as text on the dashboard.

**You need `ANTHROPIC_API_KEY` set (Vercel + local `.env.local`) for
generation to work** — everything else in Phase 1 still works without it.

## What's built in this phase

- Internal team login (magic link via Supabase Auth), gates `/dashboard`
- `/dashboard`: create a project (client name → generates a unique, unguessable
  onboarding link), list projects with status, view submitted answers
- `/onboard/[slug]`: public, no-login multi-step wizard — one questionnaire
  section per screen, autosaves on every "Next," resumable if the client
  closes the tab and comes back to the same link
- Full 14-section / 203-field onboarding schema, generated from your
  `FUND_STRATEGY & ONBOARDING QUESTIONNAIRE` doc, in `config/onboardingSchema.ts`
- Supabase schema + RLS in `supabase/migrations/0001_init.sql`, including
  `generated_assets` / `asset_files` tables (unused until Phase 2, added now
  so that phase doesn't require touching what's built here)

## How client privacy is handled (per your last note)

The client filling the form **never gets a login** and the wizard **never
reads or displays** `generated_assets`/`asset_files` — there's no code path
that would let it. Those tables also have no RLS policy granting anonymous
access, so even a direct API call from the browser can't reach them. Only
authenticated team members (via `/login`) can see generated content. This is
already true of what's built — nothing further is needed for this guarantee
in Phase 1.

For Phase 4 (file delivery), we still need to decide: deliver via Supabase
Storage (private, signed URLs, team-login-gated — already consistent with the
model above) or push files to SharePoint via Microsoft Graph API. SharePoint
is very doable but needs an Azure AD app registration on your work tenant —
flagging now so IT/admin approval isn't a surprise later. We can decide when
we get to Phase 4; doesn't block anything now.

## Accounts you need to set up

1. **GitHub** — create an empty repo (e.g. `x100`). I'll give you the
   code to push, or you can upload this folder directly.
2. **Supabase** — [supabase.com](https://supabase.com) → New Project. You'll need:
   - Project URL and anon key (Settings → API) → `.env.local`
   - Service role key (Settings → API → also shown there, keep secret) → `.env.local`
   - Run the migration: either paste `supabase/migrations/0001_init.sql` into
     the SQL Editor in the Supabase dashboard, or install the Supabase CLI and
     run `supabase db push` — either works fine for a project this size.
   - Enable Email auth (Authentication → Providers → Email) — magic link is
     on by default.
   - Add yourself as a team user: Authentication → Users → Add user (or just
     go to `/login` once deployed and use your email — first sign-in creates
     the user automatically).
3. **Vercel** — [vercel.com](https://vercel.com) → New Project → import the
   GitHub repo. Add the same env vars from `.env.local` in Project Settings →
   Environment Variables. Auto-deploys on every push to `main` once connected.
4. **Anthropic** — [console.anthropic.com](https://console.anthropic.com) →
   create an API key. Not used until Phase 2, but worth generating now so
   it's ready. Add as `ANTHROPIC_API_KEY` when we get there.

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in .env.local with your Supabase project's values
npm run dev
```

Visit `http://localhost:3000/login` to sign in as your team, or
`http://localhost:3000/dashboard` to create your first test project and get
an onboarding link.

## Approval workflow (foundational documents)

Six assets are now **foundational** — generated first, require approval, and gate every other asset in the project from being generated at all until all six are approved:

- ICP Generation (Ideal Customer Profile)
- Brand Identity
- Brand Guidelines
- Messaging Framework
- Case Studies
- DDQ Drafting (Due Diligence Questionnaire)

Behavior:
- Foundational assets can be generated any time onboarding has *any* saved answers — full completion is **not** required. This lets staff kick these off early from an in-progress project.
- The other 12 ("marketing") assets are locked — the Generate button is disabled and the API route itself rejects the request — until (a) onboarding is fully complete, and (b) all 6 foundational assets have `approval_status = 'approved'`. This is enforced server-side in `app/api/generate/route.ts`, not just hidden in the UI.
- Approvers can **edit the generated content directly** before approving (an "Edit" toggle on each foundational asset's card) — the edited text becomes the new `content`, which is what downstream context/exports will use.
- **Anyone signed in can approve or reject for now.** Restricting approval to specific team members by email is a placeholder for later — the one place that check needs to be added is called out with a comment in `app/api/assets/review/route.ts`.
- None of the 6 foundational documents had source prompt materials — their system prompts were drafted from standard industry practice (same caveat as Executive Briefing). Review these more carefully than the ones built from your actual prompt docs, especially **DDQ Drafting**, which explicitly should not be sent to any investor without real legal/compliance review regardless of how complete it looks.

**Migration note:** run `supabase/migrations/0002_approval_workflow.sql` in addition to `0001_init.sql` if you haven't already — it adds the `approval_status`, `approved_by`, and `approved_at` columns to `generated_assets`.

## Approval workflow (foundational documents) — updated

Six assets are **foundational** — generated together as a batch, all go through review:

- ICP Generation, Brand Identity, Brand Guidelines, Messaging Framework — **required**. All four must be approved before any marketing asset can be generated.
- Case Studies, DDQ Drafting — **optional**. Still generated, still show approve/reject, but don't block anything downstream.

**Trigger points (fully automatic, no button click required):**
1. **Client submits onboarding** (all 14 sections complete) → all 6 foundational documents generate automatically in the background as part of that submission. The client's Submit button shows "this may take a minute" while it runs.
2. **Staff early-trigger** — on any in-progress project (even with only a few sections filled in), the project detail page has a **"Generate all foundational"** button that runs the same batch on whatever answers exist so far. Individual per-document Generate/Regenerate buttons still work too, for redoing just one.

**Approver restriction** — set via the `APPROVER_EMAILS` environment variable in Vercel (comma-separated emails). Leave it unset and anyone signed in can approve, same as before. This is a pure env-var change — **no code change or file from me needed** to add/remove approvers, just:
1. Vercel → Settings → Environment Variables → add `APPROVER_EMAILS` = `you@company.com,jeff@company.com,pm2@company.com`
2. Redeploy (env var changes need a redeploy to take effect, same as any other env var here)

Editing generated content before approval is intentionally **not** restricted to approvers — any signed-in team member can use the Edit button; only Approve/Reject are gated by the allowlist.

**Migration note:** run `supabase/migrations/0002_approval_workflow.sql` if you haven't already — no new migration was needed for this round, the existing approval columns cover everything here.

## What I need from you to move to Phase 3

Once you've tested the Cold Outreach Email generation and are happy with
the output quality (or have feedback on tone/prompt tuning):
- Confirm you're ready to add the remaining 7 assets (website hero, landing
  page, follow-up email, LinkedIn post, one-pager, investor FAQ, voicemail
  script) as config entries the same way
- Any example copy/briefs you already have for those 7, if you want the
  prompts tuned to match an existing voice rather than written from scratch
- Confirmation on delivery target for file export (Supabase Storage vs
  SharePoint) so Phase 3/4 builds the right output path from the start
