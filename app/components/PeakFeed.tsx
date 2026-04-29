"use client";

import type { MarketPost } from "@/app/lib/mock-markets";
import { useState } from "react";
import type { Peak } from "@/lib/peaks/store";
import { PostActions } from "@/app/components/post/PostActions";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function MarketPostCard({ post }: { post: MarketPost }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [yes, no] = post.outcomes;

  return (
    <article
      data-sparkle-click="true"
      className="poppy-hover sparkle-hover rounded-2xl border border-zinc-200/90 bg-white/[0.97] p-4 shadow-sm backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95"
      aria-label={`Prediction market: ${post.question}`}
    >
      <header className="flex gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white/30 dark:ring-zinc-700"
          style={{ backgroundColor: `hsl(${post.avatarHue} 55% 42%)` }}
          aria-hidden
        >
          {post.creator
            .split(" ")
            .map((w) => w[0])
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
              {post.creator}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {post.handle}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{post.postedAt}</span>
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 dark:text-emerald-400">
              peaksees
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
              {post.category}
            </span>
            {post.postedAt.toLowerCase().includes("live") ? (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-600 dark:text-red-400">
                LIVE
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <h2 className="mt-4 text-[17px] font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
        {post.question}
      </h2>

      <div className="mt-4 space-y-2">
        {[yes, no].map((outcome) => {
          const pct = Math.round(outcome.probability * 100);
          const isPicked = selected === outcome.id;
          return (
            <button
              key={outcome.id}
              type="button"
              data-sparkle-click="true"
              onClick={() => setSelected(outcome.id)}
              className={
                "relative w-full overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-colors " +
                (isPicked
                  ? "border-emerald-500/70 bg-emerald-500/[0.08] ring-2 ring-emerald-500/25 dark:border-emerald-400/50 dark:bg-emerald-500/10"
                  : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/80")
              }
            >
              <span
                className="absolute inset-y-0 left-0 bg-emerald-400/25 dark:bg-emerald-500/20"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {outcome.label}
                </span>
                <span className="tabular-nums font-semibold text-zinc-700 dark:text-zinc-200">
                  {pct}%
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span>Vol · {formatUsd(post.volumeUsd)}</span>
        <span>
          Settles · {post.endsAtLabel}
          {selected && (
            <span className="ml-2 text-emerald-600 dark:text-emerald-400">
              · You leaned {yes.id === selected ? yes.label : no.label}
            </span>
          )}
        </span>
      </footer>

      <PostActions postKey={`market:${post.id}`} title={post.question} />
    </article>
  );
}

export function PeakFeed({
  posts,
  contextLabel,
  peaks = [],
}: {
  posts: MarketPost[];
  contextLabel?: string;
  peaks?: Peak[];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="mx-auto flex w-full max-w-xl flex-col gap-3 px-2 pb-28 pt-4 sm:gap-5 sm:px-4 sm:pb-24 md:pt-8">
        {contextLabel ? (
          <li>
            <div className="rounded-xl border border-zinc-200/90 bg-white/95 px-4 py-2 text-sm text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300">
              Exploring: <span className="font-semibold">{contextLabel}</span>
            </div>
          </li>
        ) : null}
        {peaks.length > 0 ? (
          <li>
            <div className="rounded-2xl border border-zinc-200/90 bg-white/[0.97] p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/95">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Latest peaks
              </p>
              <ul className="mt-3 space-y-2">
                {peaks.slice(0, 6).map((p) => (
                  <li
                    key={p.id}
                    data-sparkle-click="true"
                    className="sparkle-hover rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{p.displayName}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(p.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                      {p.text}
                    </p>
                    <PostActions postKey={`peak:${p.id}`} title={p.text} />
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ) : null}
        {posts.map((post) => (
          <li key={post.id}>
            <MarketPostCard post={post} />
          </li>
        ))}
      </ul>
    </div>
  );
}
