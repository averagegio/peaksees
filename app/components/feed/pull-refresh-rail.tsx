"use client";

function PullRefreshChevron({ ready }: { ready: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
      style={{ transform: ready ? "rotate(180deg)" : "rotate(0deg)" }}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Maps drag travel to rail size with light rubber-band saturation. */
export function pullDisplacement(delta: number) {
  const dampened = delta * 0.42;
  return Math.min(96, dampened * (1 + Math.log1p(dampened / 140)));
}

export function PullRefreshRail({
  expandedPx,
  loading,
  thresholdPx = 48,
  orientation = "horizontal",
}: {
  expandedPx: number;
  loading: boolean;
  thresholdPx?: number;
  orientation?: "horizontal" | "vertical";
}) {
  const maxProgressPx = 80;
  const size = loading ? 78 : expandedPx;
  if (size < 2 && !loading) return null;
  const progress = loading ? 1 : Math.min(1, expandedPx / maxProgressPx);
  const ready = !loading && expandedPx >= thresholdPx;
  const railR = 15;
  const circ = 2 * Math.PI * railR;
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      role={loading ? "status" : undefined}
      aria-live={loading ? "polite" : undefined}
      aria-busy={loading || undefined}
      data-pull-rail=""
      className={
        "pointer-events-none flex shrink-0 items-center justify-center overflow-hidden motion-safe:duration-[240ms] motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] " +
        (isHorizontal
          ? "h-full flex-row bg-gradient-to-r from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent pr-1 motion-safe:transition-[width] dark:from-emerald-400/[0.09]"
          : "w-full flex-col bg-gradient-to-b from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent pb-1 motion-safe:transition-[height] dark:from-emerald-400/[0.09]")
      }
      style={isHorizontal ? { width: size } : { height: size }}
    >
      <div
        className={`relative mx-auto flex h-[46px] w-[46px] items-center justify-center motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out ${
          loading ? "animate-pull-refresh-breathe" : ready ? "scale-[1.06]" : "scale-100"
        }`}
      >
        {loading ? (
          <>
            <svg
              viewBox="0 0 40 40"
              className="absolute inset-0 h-[46px] w-[46px] -rotate-90 motion-safe:animate-spin motion-safe:[animation-duration:780ms] text-emerald-600 dark:text-emerald-400"
              aria-hidden
            >
              <circle
                cx="20"
                cy="20"
                r={railR}
                fill="none"
                strokeWidth="2.5"
                className="text-zinc-200 dark:text-zinc-600"
                stroke="currentColor"
              />
              <circle
                cx="20"
                cy="20"
                r={railR}
                fill="none"
                strokeWidth="3"
                strokeLinecap="round"
                stroke="currentColor"
                strokeDasharray="22 999"
              />
            </svg>
            <span className="relative z-[1] h-[30px] w-[30px] rounded-full border border-emerald-200/35 bg-white/95 shadow-inner shadow-emerald-500/12 dark:border-emerald-500/20 dark:bg-zinc-900/96 dark:shadow-black/40" />
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 40 40"
              className="absolute inset-0 h-[46px] w-[46px] -rotate-90 text-emerald-600 motion-reduce:hidden dark:text-emerald-400"
              aria-hidden
            >
              <circle
                cx="20"
                cy="20"
                r={railR}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-emerald-200/70 dark:text-zinc-600"
              />
              <circle
                cx="20"
                cy="20"
                r={railR}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${circ} ${circ}`}
                strokeDashoffset={circ * (1 - progress)}
                className="opacity-95 drop-shadow-sm transition-[stroke-dashoffset] duration-75 ease-out"
              />
            </svg>
            <div
              className="relative z-[1] flex h-[34px] w-[34px] items-center justify-center rounded-full border border-zinc-200/90 bg-white/95 text-emerald-700 shadow-sm dark:border-zinc-600 dark:bg-zinc-900/95 dark:text-emerald-300"
              style={{ opacity: 0.45 + progress * 0.55 }}
            >
              <PullRefreshChevron ready={ready} />
            </div>
          </>
        )}
      </div>
      {loading ? (
        <span className="mt-1.5 text-[11px] font-semibold tracking-wide text-emerald-800/90 dark:text-emerald-300/95">
          Refreshing…
        </span>
      ) : expandedPx >= 8 ? (
        <span
          className={`mt-1.5 text-[11px] font-medium motion-safe:transition-colors motion-safe:duration-200 ${
            ready ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {ready ? "Release to refresh" : "Pull to refresh"}
        </span>
      ) : null}
    </div>
  );
}
