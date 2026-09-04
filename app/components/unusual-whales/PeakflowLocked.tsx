import Link from "next/link";

import { peakflowUpgradeCopy, type MemberPlan } from "@/lib/membership/plans";

export function PeakflowLocked({
  signedIn,
  currentPlan = "free",
}: {
  signedIn: boolean;
  currentPlan?: MemberPlan;
}) {
  const copy = peakflowUpgradeCopy(currentPlan);

  return (
    <section
      data-testid="peakflow-upgrade-gate"
      className="rounded-2xl border border-emerald-500/25 bg-white p-6 shadow-sm dark:border-emerald-500/20 dark:bg-zinc-950"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        {copy.eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
        {copy.title}
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{copy.body}</p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/70">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Your plan
          </dt>
          <dd className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {copy.currentPlanLabel}
          </dd>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Upgrade to
          </dt>
          <dd className="mt-1 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {copy.requiredPlanLabel} · {copy.price}
          </dd>
        </div>
      </dl>

      <ul className="mt-5 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
        {[
          "Unusual options flow alerts",
          "Dark pool prints",
          "Congressional trades",
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap gap-2">
        {signedIn ? (
          <Link
            href={copy.href}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            {copy.cta}
          </Link>
        ) : (
          <Link
            href="/login?next=/peakflow"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Sign in to upgrade
          </Link>
        )}
        <Link
          href="/pricing"
          className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
        >
          Compare plans
        </Link>
      </div>
    </section>
  );
}

export function PeakflowUnavailable({ message }: { message: string }) {
  return (
    <section
      data-testid="peakflow-unavailable"
      className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800 shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
    >
      <h2 className="text-base font-extrabold">Peakflow could not load</h2>
      <p className="mt-2">{message}</p>
      <p className="mt-2 text-rose-700/90 dark:text-rose-300/90">
        Your plan already includes Peakflow. This is a data error, not an upgrade
        gate.
      </p>
    </section>
  );
}
