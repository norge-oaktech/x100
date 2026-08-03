import Link from "next/link";

// This app has no public marketing homepage. Internal team lands on
// /dashboard (auth-gated); clients only ever receive a direct
// /onboard/[slug] link and never see this page.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-medium">x100</h1>
      <p className="max-w-sm text-sm text-slate-600">
        Internal tool. If you&apos;re a client, use the link sent to you
        directly.
      </p>
      <Link
        href="/dashboard"
        className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700"
      >
        Team dashboard
      </Link>
    </main>
  );
}
