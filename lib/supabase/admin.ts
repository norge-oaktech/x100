import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// SERVICE ROLE client — bypasses RLS entirely. Never import this into any
// client component or expose it to the browser.
//
// Why the public onboarding flow needs it: the client filling in the form
// has no Supabase auth session (by design — see architecture notes), so it
// cannot satisfy the RLS policies that gate the internal tables. Instead,
// the server action in app/(public)/onboard/[slug]/actions.ts:
//   1. uses this admin client to look up the project by its unguessable slug
//   2. validates the project is in an onboarding-eligible status
//   3. writes ONLY to onboarding_responses for that specific project id
// The admin client is never passed to the browser and every write here is
// scoped by application logic, not by a client-controlled session.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
