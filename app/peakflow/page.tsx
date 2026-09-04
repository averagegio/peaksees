import Link from "next/link";
import { redirect } from "next/navigation";

import { BackButton } from "@/app/components/BackButton";
import { PeakflowLocked } from "@/app/components/unusual-whales/PeakflowLocked";
import { UnusualWhalesBoard } from "@/app/components/unusual-whales/UnusualWhalesBoard";
import { getSession } from "@/lib/auth/session";
import { fetchDashboardSnapshot } from "@/lib/unusual-whales/client";
import { hasPeakPlusTier } from "@/lib/membership/plans";

export default async function PeakflowPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/peakflow");

  const allowed = hasPeakPlusTier(session.user.memberPlan);
  const snapshot = allowed ? await fetchDashboardSnapshot() : null;

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
              Peakflow
            </h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Unusual Whales options flow, dark pool, and congressional tape for PeakPlus
              members.
            </p>
          </div>
        </header>
        {allowed && snapshot ? (
          <UnusualWhalesBoard desk="subscriber" initial={snapshot} />
        ) : (
          <PeakflowLocked signedIn />
        )}
      </div>
    </main>
  );
}
