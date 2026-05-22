import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MarketPostCard } from "@/app/components/PeakFeed";
import { BackButton } from "@/app/components/BackButton";
import { marketToPost } from "@/app/lib/peak-market";
import {
  MARKET_FEED_FOLLOWING,
  MARKET_FEED_FOR_YOU,
  MARKET_FEED_LIVE,
} from "@/app/lib/mock-markets";
import { getSession } from "@/lib/auth/session";
import { getUserByHandleSlug } from "@/lib/auth/users-store";
import { listPeakAiMarkets } from "@/lib/markets/store";
import { isPeakAiHandle, PEAK_AI_PROFILE } from "@/lib/peak-ai/profile";

function normalizeHandleParam(handle: string) {
  const h = decodeURIComponent(handle).trim();
  return h.replace(/^@/, "");
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { handle } = await params;
  const slug = normalizeHandleParam(handle);
  if (!slug) notFound();

  if (isPeakAiHandle(slug)) {
    const markets = await listPeakAiMarkets({ limit: 200 });
    const posts = markets.map((m) => marketToPost(m));
    const { displayName, handle: atHandle, avatarHue, bio } = PEAK_AI_PROFILE;

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
          </header>

          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div
              className="h-24 bg-gradient-to-r sm:h-28"
              style={{
                backgroundImage: `linear-gradient(90deg, hsl(${avatarHue} 65% 40% / 0.95), hsl(${
                  (avatarHue + 65) % 360
                } 70% 38% / 0.85))`,
              }}
            />
            <div className="relative -mt-9 flex flex-col gap-4 px-6 pb-6">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white text-lg font-bold text-white shadow-lg dark:border-zinc-900"
                style={{ backgroundColor: `hsl(${avatarHue} 55% 42%)` }}
                aria-hidden
              >
                PA
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                  {displayName}
                </h1>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{atHandle}</p>
                <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  Automated market publisher
                </p>
              </div>

              <p className="rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                {bio}
              </p>
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-4 flex items-baseline justify-between gap-3 px-1">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Markets by Peak AI
              </h2>
              <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {posts.length} {posts.length === 1 ? "market" : "markets"}
              </span>
            </div>
            {posts.length === 0 ? (
              <p className="px-1 text-sm text-zinc-600 dark:text-zinc-300">
                No Peak AI markets yet — they appear after the feed refreshes or the daily cron runs.
              </p>
            ) : (
              <ul className="space-y-4">
                {posts.map((post) => (
                  <li key={post.id}>
                    <MarketPostCard post={post} viewerUserId={session.user.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    );
  }

  const realUser = await getUserByHandleSlug(slug);
  if (realUser) redirect(`/u/${encodeURIComponent(realUser.id)}`);

  const fullHandle = `@${slug}`;
  const all = [...MARKET_FEED_FOR_YOU, ...MARKET_FEED_FOLLOWING, ...MARKET_FEED_LIVE];
  const posts = all.filter((p) => p.handle.toLowerCase() === fullHandle.toLowerCase()).slice(0, 12);
  const displayName = posts[0]?.creator ?? slug;
  const hue = posts[0]?.avatarHue ?? 160;

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
        </header>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div
            className="h-24 bg-gradient-to-r sm:h-28"
            style={{
              backgroundImage: `linear-gradient(90deg, hsl(${hue} 65% 40% / 0.95), hsl(${
                (hue + 65) % 360
              } 70% 38% / 0.85))`,
            }}
          />
          <div className="relative -mt-9 flex flex-col gap-4 px-6 pb-6">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white text-lg font-bold text-white shadow-lg dark:border-zinc-900"
              style={{ backgroundColor: `hsl(${hue} 55% 42%)` }}
              aria-hidden
            >
              {displayName
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                {displayName}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{fullHandle}</p>
            </div>

            <div className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              Sample creator profile from demo feed data. Link your account with this handle in
              settings to claim it.
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Markets</h2>
          </div>
          <div className="px-6 py-5">
            {posts.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">No markets found.</p>
            ) : (
              <ul className="space-y-3">
                {posts.map((p) => (
                  <li
                    key={`m-${p.id}`}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{p.question}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {p.category} · Settles {p.endsAtLabel}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
