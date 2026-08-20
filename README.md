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

## Asset catalog restructure (Phase 2 + 3A)

The flat 13-asset "marketing" list has been replaced with a phase-organized structure matching your Phase 2/3A/3B/3C planning docs:

- **Dropped:** Cold Outreach Email, Terms of Service, Privacy Policy, Executive Briefing — none were in the Phase 2/3A screenshots. Cold Outreach Email conceptually returns under Phase 3B ("Email Sequences"/"Outbound Sequences") when that phase gets built.
- **Phase 2 — Fundraising & Legal** (5 assets): Business PPM Draft, Business Profile, Proforma Explanations, Legal Draft Assistance, Pitch Deck Copy (kept from before, reassigned here).
- **Phase 3A — Marketing Content** (25 assets): Website Homepage/Fund/About/Contact, Landing Page, Teaser, both Event Presentations (all kept from before) + 17 new text assets — Blog Article, LinkedIn/X/Facebook/Reddit/Bluesky/TikTok/Substack posts, Lead Magnet, SEO Page Copy, Google Business Profile, AI SEO/GEO Content, Webinar Q&A Prep, Press Release, Event Landing Page/RSVP, Webinar Talking Points, Event Email Content.
- **Not built:** Phase 3B (Sales Enablement) and Phase 3C (Video & Audio) — 3C specifically needs real image/video/voice generation integrations (HeyGen, ElevenLabs, Opus Clip, Higgsfield, Vapi, etc.) that don't exist in this app yet. That's a separate integration project per tool, not something that follows from writing more Claude prompts — flag when you're ready to scope that.
- **Gating:** unchanged — all Phase 2 + 3A assets unlock together once the 4 required foundational documents are approved. No approval step of their own (same as the old marketing tier). No sequential lock between Phase 2 and 3A themselves.
- **UI:** the Marketing Assets section now groups cards under a phase sub-header ("Phase 2 — Fundraising & Legal", "Phase 3A — Marketing Content") instead of one flat list.
- All 21 new system prompts were drafted from standard practice for each format, not client-supplied instructions — same review caveat as the foundational documents and Executive Briefing before it.

## Image generation (social posts, teaser, event banners)

Seven assets now support an optional accompanying AI-generated image, using OpenAI's `gpt-image-1`: LinkedIn Post, X Post, Facebook Post, Reddit Post, Bluesky Post, TikTok Script (cover image), Investor Teaser, plus a new **Event Banner** asset (caption + image, no other body text).

**Setup required — this needs a real OpenAI API key, not a ChatGPT login:**
1. Go to **platform.openai.com** (not chat.openai.com) → **Settings → Billing** → add a payment method (separate from any ChatGPT subscription).
2. **API Keys** → **Create new secret key** → copy the `sk-...` value.
3. Add `OPENAI_API_KEY` in Vercel (Environment Variables) and locally in `.env.local`.
4. **First-time-only:** OpenAI requires "API Organization Verification" before `gpt-image-1` will work on a new key/org — if the first image generation attempt fails with a verification error, that's expected; complete verification at platform.openai.com and retry.

**How it works:**
- Image generation is a **separate step from text generation** — the text asset (e.g. the LinkedIn post copy) must already be generated before the "Images" section on that card becomes available.
- Each image-capable card gets: a gallery of generated images, a custom-prompt textarea (optional — leave blank to use a default prompt built from the fund's stated visual style), a count selector (1/2/4 images per generation, up to OpenAI's max of 10 per call), and a Generate/Regenerate button.
- Every image has its own **Download** link (opens the full-resolution file).
- Regenerating **replaces** the current set of images for that asset, it doesn't append to it.
- Default image prompts explicitly avoid: legible text/words in the image, real named individuals, and real logos/trademarks — image models render text poorly and can't accurately depict real people, so asking for those produces bad or misleading results.

**Storage & access:** generated images live in a private Supabase Storage bucket (`asset-images`), never public — the app displays them via short-lived (1 hour) signed URLs generated fresh on every page load, same "team login required" model as everything else in this app.

**Migration required:** run `supabase/migrations/0003_asset_images_storage.sql` — creates the storage bucket and extends `asset_files` to allow the `png` format.

**Cost note:** `gpt-image-1` is priced per-image (roughly $0.005–$0.052 depending on quality/size) or token-based — cheap per image, but this is a genuinely new cost source on top of the Anthropic text-generation costs tracked earlier. Not yet folded into the per-asset cost estimates I gave you before.

**Not built:** actual video or voice generation (Phase 3C) — this covers static images only.

## Navigation shell (Clients, Approvals, Settings)

Added a persistent sidebar to all `/dashboard/**` pages (not `/login`, which stays a standalone screen), matching the "Project Atlas" reference spec's navigation pattern where it made sense without overbuilding:

- **Dashboard** — unchanged, the existing project list/stats
- **Clients** (new) — list of all clients with project counts; click through to a client detail page listing their projects. Uses the existing `clients` table, no new data model.
- **Approvals** (new) — a single queue across *every* project showing everything with `approval_status = 'pending'`, with inline Approve/Reject and a "Preview" toggle to read the content without leaving the page. This is the same review action as before (`/api/assets/review`), just aggregated instead of per-project — should be the fastest path for whoever's approving day to day.
- **Settings** (new) — read-only: shows the current `APPROVER_EMAILS` configuration and which AI providers/services this deployment uses. Intentionally minimal — no fake toggles for things that aren't actually configurable yet.

**What I did NOT add**, since the client's own spec called for them but building them now would mean either faking functionality or a much bigger change: **Workflows** (formal multi-stage pipeline), **Deliverables** (versioned entity separate from `generated_assets`), and **Prompt Library** (DB-backed, UI-editable prompts — prompts stay in `config/assets.ts` per your earlier decision). Nav only links to pages that are real; no dead-end items.

**Known gap surfaced while building this:** creating a new project only ever creates a brand-new client row, even if you type a name matching an existing client exactly — there's no "pick an existing client" dropdown yet. Worth fixing if the Clients page reveals duplicate client rows in practice; flagging now rather than fixing silently since it wasn't part of what was asked this round.

## HTML Landing Page (Lovable replacement, for GHL)

New asset: **Investor Landing Page — HTML (for GHL)**, `investor_landing_page_html`, alongside the existing plain-copy version (kept — some situations still just need reference text, not code).

- Claude generates a complete, self-contained HTML document — inline CSS, no build step, no external framework, mobile-responsive — ready to paste directly into GoHighLevel's **Custom HTML** page element.
- **Lead capture is the one manual step:** a static HTML form has nowhere to send data, and GHL's CRM only receives submissions from GHL-native forms. The generated HTML includes a clearly marked placeholder comment (`<!-- GHL_FORM_EMBED: ... -->`) inside a pre-styled container exactly where the form should go — build the real form in GHL (a couple of minutes), grab its embed snippet, and drop it into that spot.
- Copy button already works for this — it copies the raw HTML string, ready to paste as-is.
- Added a safety net in the generate route that strips a stray ```` ```html ```` code fence if Claude adds one despite instructions not to (a known LLM habit that would otherwise break a direct paste).
- This replaces the earlier idea of connecting Lovable — no new account, API key, or vendor needed for this one.

**Decided against integrating:** Lovable (replaced by the above), Vapi (its job is placing live phone calls, not generating content — only relevant if you want the app to actually dial numbers, which is a different feature with its own compliance considerations), and Perplexity (only needed if AI SEO/GEO content should be grounded in live web search — Claude's own API has a native web search tool that covers the same need without a second vendor; let me know if you want that turned on).

## Real PowerPoint files (Gamma replacement)

Pitch Deck, Event Presentation — Educational, and Event Presentation — Solicitation now generate **actual downloadable `.pptx` files** — no Gamma needed.

**How it works:**
- Claude now outputs structured JSON (slide titles, bullets, speaker notes) instead of free-form prose — required so a program can reliably turn it into real slides. This happens automatically as part of the normal "Generate" click, same as images.
- The app builds a real PowerPoint file server-side using `pptxgenjs` — a clean institutional template (navy cover slide, off-white content slides, consistent accent color), speaker notes go into PowerPoint's actual Notes field, not printed on the slide itself.
- The file uploads to a new private Supabase Storage bucket, `asset-documents` (same signed-URL, team-only-access pattern as generated images).
- Each deck card now shows a **readable slide-by-slide preview** in the app (title, bullets, notes per slide) instead of a wall of text, plus a **Download deck (.pptx)** button.
- Verified the actual generated file opens as valid PowerPoint (tested the raw OOXML structure, not just that code compiles) before shipping this.
- Deck structure was also tightened from the original 11–14 "flexible" slide count to a fixed 10–12 slides per deck, since a real file needs a definite slide count, not a range.

**Migration required:** run `supabase/migrations/0004_asset_documents_storage.sql` — creates the new bucket and extends `asset_files` to allow the `pptx` format.

**One realistic limitation to know about:** this generates clean, readable, on-brand slides — it does not replicate Gamma's AI-driven layout variety (varying slide compositions, generated imagery per slide, etc.). If a deck needs that level of visual production value, someone would still open the `.pptx` in PowerPoint and polish it further. This gets you a legitimate, presentable starting deck for free, not a finished creative-agency-quality product.

## What I need from you next

- Review the Phase 2 + 3A outputs once generated, especially **Business PPM Draft** and **Legal Draft Assistance** (both explicitly designed to defer heavily to real counsel — worth confirming that comes through clearly in practice, not just in the prompt).
- Any real prompt materials for Phase 2/3A items if you have them, to replace the standard-practice drafts with your actual voice/structure.
- Whenever you're ready to scope Phase 3B (Sales Enablement) — those are all still text-only, so straightforward to add the same way.
- Whenever you're ready to scope Phase 3C (Video & Audio) — this needs a separate conversation about which specific tools to integrate and API access for each, since it's new infrastructure, not new prompts.
