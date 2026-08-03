import { createBrowserClient } from "@supabase/ssr";

// Used only in client components inside the internal (team) dashboard.
// The public onboarding form never imports this — it writes through a
// server action so the anon key + RLS session are never exposed to
// unauthenticated visitors.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
