# x100 — Phase 1 (Onboarding)

Data-driven copy-generation app. This delivery covers **Phase 1 only**:
client onboarding intake. No Anthropic calls, no file generation, no exports
yet — those are Phases 2–4.

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

## What I need from you to move to Phase 2

Once you've reviewed Phase 1 and it works the way you expect:
- Confirm the 8-asset shortlist from before (website hero, landing page,
  cold outreach email, follow-up email, LinkedIn post, one-pager, investor
  FAQ, voicemail script) or adjust it
- Any example copy/briefs you already have for those 8, if you want the
  prompts tuned to match an existing voice rather than written from scratch
- Confirmation on Phase 4's delivery target (Supabase Storage vs SharePoint)
  so Phase 2's asset config can be built with the right output path in mind
