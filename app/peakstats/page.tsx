import Link from "next/link";
import { redirect } from "next/navigation";

import { BackButton } from "@/app/components/BackButton";
import { getSession } from "@/lib/auth/session";
import { listPeakstatsLeaderboard } from "@/lib/peakpoints/leaderboard";

function formatUsdCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function PeakstatsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await listPeakstatsLeaderboard({ limit: 50 });

  return (
    <main className="min-h-dvh bg-gradient-to-b from-zinc-100 to-zinc-200/90 px-4 py-10 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <BackButton fallbackHref="/feed" iconOnly />
            <Link
              href="/feed"
              className="text-sm font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
            >
              Back to feed
            </Link>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Peakstats
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Top accounts by Peakpoints balance.
            </p>
          </div>
        </header>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((r, idx) => (
              <li key={r.userId} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-8 shrink-0 text-sm font-extrabold text-zinc-500 dark:text-zinc-400">
                    #{idx + 1}
                  </span>
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL avatars
                    <img
                      src={r.avatarUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-xl object-cover ring-2 ring-zinc-200 dark:ring-zinc-800"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
                      {r.displayName
                        .split(/\s+/)
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {r.displayName}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {r.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">
                    {formatUsdCents(r.balanceCents)}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Peakpoints</p>
                </div>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="px-5 py-6 text-sm text-zinc-600 dark:text-zinc-300">
                No accounts yet.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </main>
  );
}

