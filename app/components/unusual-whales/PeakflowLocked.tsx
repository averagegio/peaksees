import Link from "next/link";

export function PeakflowLocked({
  signedIn,
}: {
  signedIn: boolean;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        PeakPlus
      </p>
      <h2 className="mt-2 text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
        Unusual Whales desk is for members
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Subscribe to PeakPlus or higher to follow unusual options flow, dark pool prints,
        and congressional trades on Peaksees.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {signedIn ? (
          <Link
            href="/pricing"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Upgrade plan
          </Link>
        ) : (
          <Link
            href="/login?next=/peakflow"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Sign in
          </Link>
        )}
        <Link
          href="/feed"
          className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
        >
          Back to feed
        </Link>
      </div>
    </section>
  );
}
