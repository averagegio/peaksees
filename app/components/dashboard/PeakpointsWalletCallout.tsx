import Link from "next/link";

function PeakpointsCoinGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      aria-hidden
    >
      <path d="M12 2c5 0 9 1.8 9 4s-4 4-9 4-9-1.8-9-4 4-4 9-4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6v6c0 2.2 4 4 9 4s9-1.8 9-4V6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12v6c0 2.2 4 4 9 4s9-1.8 9-4v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Prominent link to /peakpoints for new users funding their wallet from the dashboard. */
export function PeakpointsWalletCallout() {
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-500/[0.08] to-teal-600/[0.06] shadow-sm dark:border-emerald-800/50 dark:from-emerald-500/[0.07] dark:to-teal-900/20">
      <Link
        href="/peakpoints"
        className="group flex items-center gap-3 px-4 py-4 transition-colors hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.05] sm:gap-4 sm:px-6 sm:py-5"
      >
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-white text-emerald-700 shadow-sm dark:border-emerald-500/35 dark:bg-emerald-950/60 dark:text-emerald-400"
          aria-hidden
        >
          <PeakpointsCoinGlyph className="size-[1.35rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Peakpoints wallet
          </p>
          <p className="mt-0.5 text-sm leading-snug text-zinc-600 dark:text-zinc-400">
            Add money to trade on markets in your feed—open your wallet to deposit with Stripe.
          </p>
        </div>
        <span className="hidden shrink-0 text-sm font-semibold text-emerald-700 group-hover:underline sm:inline dark:text-emerald-400">
          Open wallet
        </span>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-white text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-400 sm:hidden"
          aria-hidden
        >
          →
        </span>
      </Link>
    </section>
  );
}
