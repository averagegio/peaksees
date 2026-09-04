import Link from "next/link";
import { redirect } from "next/navigation";

import { BackButton } from "@/app/components/BackButton";
import {
  PeakflowLocked,
  PeakflowUnavailable,
} from "@/app/components/unusual-whales/PeakflowLocked";
import { UnusualWhalesBoard } from "@/app/components/unusual-whales/UnusualWhalesBoard";
import { getSession } from "@/lib/auth/session";
import {
  evaluateSubscriberDeskAccess,
  normalizeMemberPlan,
} from "@/lib/membership/plans";
import { resolveEffectiveMemberPlan } from "@/lib/stripe/subscription-sync";
import { fetchDashboardSnapshot } from "@/lib/unusual-whales/client";

export default async function PeakflowPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/peakflow");

  const currentPlan = normalizeMemberPlan(
    await resolveEffectiveMemberPlan(session.user),
  );
  const access = evaluateSubscriberDeskAccess({
    signedIn: true,
    memberPlan: currentPlan,
    email: session.user.email,
  });

  let snapshot = null;
  let loadError: string | null = null;
  if (access.ok) {
    try {
      snapshot = await fetchDashboardSnapshot();
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Could not load Peakflow.";
    }
  }

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
              Unusual Whales options flow, dark pool, and congressional tape.
              Ask Peak for a ticker or option. Requires a PeakPlus plan or higher.
            </p>
          </div>
        </header>
        {!access.ok ? (
          <PeakflowLocked signedIn currentPlan={currentPlan} />
        ) : snapshot ? (
          <UnusualWhalesBoard desk="subscriber" initial={snapshot} />
        ) : (
          <PeakflowUnavailable
            message={loadError ?? "The Unusual Whales desk returned no data."}
          />
        )}
      </div>
    </main>
  );
}
