import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BackButton } from "@/app/components/BackButton";
import { PeakpointsWalletCallout } from "@/app/components/dashboard/PeakpointsWalletCallout";
import { LogoutButton } from "@/app/components/LogoutButton";
import { ProfileEditor } from "@/app/components/profile/ProfileEditor";
import { PEAKSEES_HEADER_BANNER } from "@/lib/brand";
import { ProfileFollowSocial } from "@/app/components/profile/ProfileFollowSocial";
import type { Peak } from "@/lib/peaks/store";
import { getSession } from "@/lib/auth/session";
import { getPeakById, listPeaks } from "@/lib/peaks/store";
import { getFollowCounts } from "@/lib/social/follows-store";
import { listPinEntries } from "@/lib/social/pins-store";

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

function parsePeakPinId(postKey: string): string | null {
  if (!postKey.startsWith("peak:")) return null;
  const id = postKey.slice("peak:".length).trim();
  return id.length > 0 ? id : null;
}

function newerIso(a: string, b: string) {
  try {
    return new Date(a) >= new Date(b) ? a : b;
  } catch {
    return a;
  }
}

type DashboardPeakRow = {
  peak: Peak;
  youPosted: boolean;
  repeakedAt: string | null;
};

async function buildDashboardPeaksAndRepeaks(viewerUserId: string): Promise<DashboardPeakRow[]> {
  const [myPeaks, pinEntries] = await Promise.all([
    listPeaks({ mineUserId: viewerUserId, limit: 80 }),
    listPinEntries(viewerUserId, 80),
  ]);

  const mineById = new Map(myPeaks.map((p) => [p.id, p]));
  const repeakedPeakIdsOrdered: Array<{ id: string; repeakedAt: string }> = [];
  for (const e of pinEntries) {
    const id = parsePeakPinId(e.postKey);
    if (id) repeakedPeakIdsOrdered.push({ id, repeakedAt: e.createdAt });
  }

  const repeakedAtById = new Map<string, string>();
  for (const x of repeakedPeakIdsOrdered) {
    repeakedAtById.set(x.id, x.repeakedAt);
  }

  const onlyRepeakedIds = [
    ...new Set(repeakedPeakIdsOrdered.map((x) => x.id)),
  ].filter((id) => !mineById.has(id));

  const fetched = (
    await Promise.all(onlyRepeakedIds.map((id) => getPeakById(id)))
  ).filter(Boolean) as Peak[];

  const byId = new Map<string, DashboardPeakRow>();

  for (const p of myPeaks) {
    byId.set(p.id, {
      peak: p,
      youPosted: true,
      repeakedAt: repeakedAtById.get(p.id) ?? null,
    });
  }

  for (const p of fetched) {
    if (byId.has(p.id)) continue;
    byId.set(p.id, {
      peak: p,
      youPosted: false,
      repeakedAt: repeakedAtById.get(p.id) ?? null,
    });
  }

  return [...byId.values()].sort((ra, rb) => {
    const sa = newerIso(
      ra.peak.createdAt,
      ra.repeakedAt ?? ra.peak.createdAt,
    );
    const sb = newerIso(
      rb.peak.createdAt,
      rb.repeakedAt ?? rb.peak.createdAt,
    );
    return sb.localeCompare(sa);
  });
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const u = session.user;
  const followCounts = await getFollowCounts(u.id);
  const peakRows = await buildDashboardPeaksAndRepeaks(u.id);

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
        <PeakpointsWalletCallout />

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="relative z-0 h-28 overflow-hidden bg-gradient-to-r from-emerald-600/90 to-teal-600/80 sm:h-32">
            {u.bannerUrl?.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL banner
              <img
                src={u.bannerUrl}
                alt=""
                className="absolute inset-0 z-0 h-full w-full object-cover opacity-95"
              />
            ) : null}
            <div className="absolute inset-0 z-[1] bg-gradient-to-r from-emerald-600/45 to-teal-600/35" />
          </div>
          <div className="relative z-10 -mt-10 flex flex-col gap-4 px-6 pb-6">
            {u.avatarUrl?.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL avatar
              <img
                src={u.avatarUrl}
                alt=""
                className="relative z-10 h-20 w-20 rounded-2xl border-4 border-white bg-white object-cover shadow-lg ring-2 ring-zinc-200/80 dark:border-zinc-900 dark:bg-zinc-900 dark:ring-zinc-700/80"
              />
            ) : (
              <div
                className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white text-2xl font-bold text-white shadow-lg ring-2 ring-zinc-200/80 dark:border-zinc-900 dark:ring-zinc-700/80"
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
              <div className="mt-4">
                <ProfileFollowSocial
                  targetUserId={u.id}
                  viewerUserId={u.id}
                  showFollowButton={false}
                  initialFollowers={followCounts.followers}
                  initialFollowing={followCounts.following}
                  initialIsFollowing={false}
                />
              </div>
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
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Your peaks &amp; repeaks
              </h3>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Posts you write and peaks you&nbsp;repeak from the feed.
              </p>
            </div>
            <Link
              href="/feed"
              className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
            >
              Open feed
            </Link>
          </div>
          <div className="px-6 py-5">
            {peakRows.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Compose peaks from the floating button on the feed, or&nbsp;repeak someone
                else&apos;s peak—the list updates here automatically.
              </p>
            ) : (
              <ul className="space-y-3">
                {peakRows.map((row) => {
                  const { peak: p, youPosted, repeakedAt } = row;
                  return (
                  <li
                    key={p.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-tight">
                      {youPosted ? (
                        <span className="font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                          Your peak
                        </span>
                      ) : (
                        <span className="font-semibold tracking-tight text-sky-700 dark:text-sky-400">
                          You repeaked
                          {repeakedAt
                            ? ` · ${new Date(repeakedAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}`
                            : ""}
                        </span>
                      )}
                      {!youPosted ? (
                        <span className="font-medium normal-case tracking-normal text-zinc-600 dark:text-zinc-400">
                          Original · {p.displayName} ({p.handle})
                        </span>
                      ) : null}
                      {youPosted && repeakedAt ? (
                        <span className="ml-auto normal-case tracking-normal text-zinc-500 dark:text-zinc-400">
                          Repeak saved ·{" "}
                          {new Date(repeakedAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-snug text-zinc-800 dark:text-zinc-100">
                      {p.text}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Posted{" "}
                        {new Date(p.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {p.expiresAt ? (
                          <> · expires {new Date(p.expiresAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}</>
                        ) : null}
                      </p>
                      <Link
                        href={`/feed?peak=${encodeURIComponent(p.id)}`}
                        className="shrink-0 text-[11px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                      >
                        View in feed
                      </Link>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}



