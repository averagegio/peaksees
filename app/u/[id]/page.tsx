import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BackButton } from "@/app/components/BackButton";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/users-store";
import { listPeaks } from "@/lib/peaks/store";

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

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const u = await getUserById(id);
  if (!u) notFound();

  const peaks = await listPeaks({ mineUserId: u.id, limit: 20 });

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
          <div className="relative -mt-10 flex flex-col gap-4 px-6 pb-6">
            {u.avatarUrl?.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL avatar
              <img
                src={u.avatarUrl}
                alt=""
                className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow-lg dark:border-zinc-900"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-emerald-600 text-2xl font-bold text-white shadow-lg dark:border-zinc-900"
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

            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                {u.displayName}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{u.email}</p>
            </div>

            <dl className="grid gap-4 border-t border-zinc-100 pt-6 text-sm dark:border-zinc-800">
              <div>
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">Member since</dt>
                <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatJoined(u.createdAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">Bio</dt>
                <dd className="mt-2 rounded-xl bg-zinc-50 p-4 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {u.bio?.trim() ? u.bio : " "}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Peaks</h2>
          </div>
          <div className="px-6 py-5">
            {peaks.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">No peaks yet.</p>
            ) : (
              <ul className="space-y-3">
                {peaks.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <p className="text-zinc-800 dark:text-zinc-100">{p.text}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(p.createdAt).toLocaleString()}
                      {p.expiresAt ? ` · Expires ${new Date(p.expiresAt).toLocaleString()}` : ""}
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

