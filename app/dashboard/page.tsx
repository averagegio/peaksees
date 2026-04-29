import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BackButton } from "@/app/components/BackButton";
import { LogoutButton } from "@/app/components/LogoutButton";
import { PEAKSEES_HEADER_BANNER } from "@/lib/brand";
import { getSession } from "@/lib/auth/session";

function formatJoined(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const u = session.user;

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
              <LogoutButton className="min-w-[92px]" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="h-24 bg-gradient-to-r from-emerald-600/90 to-teal-600/80" />
          <div className="-mt-10 flex flex-col gap-4 px-6 pb-6">
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
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                {u.displayName}
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400">{u.email}</p>
            </div>
            <dl className="grid gap-4 border-t border-zinc-100 pt-6 text-sm dark:border-zinc-800 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">Member since</dt>
                <dd className="mt-1 text-zinc-900 dark:text-zinc-100">{formatJoined(u.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">User ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-zinc-700 dark:text-zinc-300">
                  {u.id}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-medium text-zinc-500 dark:text-zinc-400">Bio</dt>
                <dd className="mt-2 rounded-xl bg-zinc-50 p-4 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
                  You haven’t added a bio yet — this dashboard is wired for profiles; edit flow can
                  plug in later.
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
    </div>
  );
}



