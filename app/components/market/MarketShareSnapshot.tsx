"use client";

import type { MarketPost } from "@/app/lib/mock-markets";
import { forwardRef } from "react";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function tickerParts(post: MarketPost) {
  const yesPct = Math.round((post.outcomes[0]?.probability ?? 0.5) * 100);
  const noPct = 100 - yesPct;
  return [
    `VOL ${formatUsd(post.volumeUsd)}`,
    `YES ${yesPct}%`,
    `NO ${noPct}%`,
    `SETTLES ${post.endsAtLabel}`,
    post.category.toUpperCase(),
  ];
}

/** Off-screen clone of the feed market card for share image capture. */
export const MarketShareSnapshot = forwardRef<
  HTMLDivElement,
  { post: MarketPost }
>(function MarketShareSnapshot({ post }, ref) {
  const [yes, no] = post.outcomes;

  return (
    <div
      ref={ref}
      className="pointer-events-none w-[600px] select-none bg-gradient-to-b from-zinc-100 to-zinc-200/90 p-6"
      aria-hidden
    >
      <article className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
        <header className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white/30"
            style={{ backgroundColor: `hsl(${post.avatarHue} 55% 42%)` }}
          >
            {post.creator
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="truncate font-semibold text-zinc-900">{post.creator}</span>
              <span className="text-sm text-zinc-500">{post.handle}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span>{post.postedAt}</span>
              <span className="text-zinc-300">·</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700">
                peaksees
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5">{post.category}</span>
            </div>
          </div>
        </header>

        <h2 className="mt-4 text-[17px] font-semibold leading-snug tracking-tight text-zinc-900">
          {post.question}
        </h2>

        {Array.isArray(post.hashtags) && post.hashtags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {post.hashtags.slice(0, 6).map((t) => (
              <span
                key={`${post.id}-tag-${t}`}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          {[yes, no].map((outcome) => {
            const pct = Math.round(outcome.probability * 100);
            return (
              <div
                key={outcome.id}
                className="relative w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-emerald-400/25"
                  style={{ width: `${pct}%` }}
                />
                <span className="relative flex items-center justify-between gap-3">
                  <span className="font-medium text-zinc-900">{outcome.label}</span>
                  <span className="tabular-nums font-semibold text-zinc-700">{pct}%</span>
                </span>
              </div>
            );
          })}
        </div>

        <footer className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {tickerParts(post).map((t) => (
              <span key={t} className="font-semibold text-zinc-700">
                {t}
              </span>
            ))}
          </div>
        </footer>
      </article>
    </div>
  );
});
