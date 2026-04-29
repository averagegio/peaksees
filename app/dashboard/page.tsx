import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BackButton } from "@/app/components/BackButton";
import { LogoutButton } from "@/app/components/LogoutButton";
import { ProfileEditor } from "@/app/components/profile/ProfileEditor";
import { PEAKSEES_HEADER_BANNER } from "@/lib/brand";
import { getSession } from "@/lib/auth/session";
import { getPeakById, listPeaks } from "@/lib/peaks/store";
import { listPins } from "@/lib/social/pins-store";
import { MARKET_FEED_FOLLOWING, MARKET_FEED_FOR_YOU, MARKET_FEED_LIVE } from "@/app/lib/mock-markets";

function formatJoined(iso: string) {
  try {
    const d = new Date(iso);
    const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(d);
    const year = new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(d);
    return `${month}, ${year}`;
  } catch {
    return iso;
  }
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const u = session.user;
  const myPeaks = await listPeaks({ mineUserId: u.id, limit: 10 });
  const pins = await listPins(u.id);
  const marketById = new Map(
    [...MARKET_FEED_FOR_YOU, ...MARKET_FEED_FOLLOWING, ...MARKET_FEED_LIVE].map((p) => [p.id, p]),
  );
  const pinnedMarkets = pins
    .filter((k) => k.startsWith("market:"))
    .map((k) => k.split(":")[1] ?? "")
    .map((id) => marketById.get(id))
    .filter(Boolean);
  const pinnedPeakIds = pins
    .filter((k) => k.startsWith("peak:"))
    .map((k) => k.split(":")[1] ?? "")
    .filter(Boolean);
  const pinnedPeaksResolved = (
    await Promise.all(pinnedPeakIds.map((id) => getPeakById(id)))
  ).filter(Boolean);

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-zinc-100 to-zinc-200/90 dark:from-zinc-950 dark:to-zinc-900">
      <header className="border-b border-zinc-200/90 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <Link href="/feed" className="mx-auto flex w-full max-w-lg justify-center">
            <Image
              src={PEAKSEES_HEADER_BANNER}
              alt="peaksees home"
              width={640}
              height={200}
              className="h-auto w-full max-h-[112px] object-contain sm:max-h-[128px] dark:brightness-[1.02]"
            />
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Your profile
            </h1>
            <div className="flex items-center gap-3">
              <BackButton fallbackHref="/feed" iconOnly />
              <Link
                href="/feed"
                className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Feed
              </Link>
              <Link
                href="/pricing"
                className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Upgrade plan
              </Link>
              <LogoutButton className="min-w-[92px]" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Pinned
            </h3>
            <Link
              href="/feed"
              className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Manage in feed
            </Link>
          </div>
          <div className="px-6 py-5">
            {pins.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Pin markets or peaks to keep them at the top.
              </p>
            ) : (
              <ul className="space-y-3">
                {pinnedMarkets.map((m) => (
                  <li key={`pm-${m!.id}`} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {m!.question}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Market · {m!.category}
                    </p>
                  </li>
                ))}
                {pinnedPeaksResolved.map((p) => (
                  <li key={`pp-${p!.id}`} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
                    <p className="text-zinc-800 dark:text-zinc-100">{p!.text}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Peak · {new Date(p!.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="relative h-28 overflow-hidden bg-gradient-to-r from-emerald-600/90 to-teal-600/80 sm:h-32">
            {u.bannerUrl?.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL banner
              <img
                src={u.bannerUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-95"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/45 to-teal-600/35" />
          </div>
          <div className="-mt-10 flex flex-col gap-4 px-6 pb-6">
            {u.avatarUrl?.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL avatar
              <img
                src={u.avatarUrl}
                alt=""
                className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-md dark:border-zinc-900"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white text-2xl font-bold text-white shadow-md dark:border-zinc-900"
                style={{ backgroundColor: "hsl(160 45% 38%)" }}
                aria-hidden
              >
                {u.displayName
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                {u.displayName}
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">{u.email}</p>
            </div>
            <ProfileEditor
              initialDisplayName={u.displayName}
              initialBio={u.bio ?? ""}
              initialAvatarUrl={u.avatarUrl ?? ""}
              initialBannerUrl={u.bannerUrl ?? ""}
            />
            <dl className="grid gap-4 border-t border-zinc-100 pt-6 text-sm dark:border-zinc-800">
              <div>
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">Member since</dt>
                <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatJoined(u.createdAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">Bio</dt>
                <dd className="mt-2 rounded-xl bg-zinc-50 p-4 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  {u.bio?.trim() ? u.bio : " "}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Your peaks
            </h3>
            <Link
              href="/feed"
              className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              View feed
            </Link>
          </div>
          <div className="px-6 py-5">
            {myPeaks.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Peaks you post will appear here.
              </p>
            ) : (
              <ul className="space-y-3">
                {myPeaks.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <p className="text-zinc-700 dark:text-zinc-200">{p.text}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(p.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}



