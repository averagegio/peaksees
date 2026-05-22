"use client";

import type { MarketPost } from "@/app/lib/mock-markets";
import { useRef, useState } from "react";
import type { Peak } from "@/lib/peaks/store";
import { usePostPin } from "@/app/hooks/usePostPin";
import { PostActions } from "@/app/components/post/PostActions";
import { MarketTradeBox } from "@/app/components/market/MarketTradeBox";
import { PeakOpinionChip } from "@/app/components/market/PeakOpinionChip";
import { ShareMarketButton } from "@/app/components/market/ShareMarketButton";
import { ProfileLink } from "@/app/components/profile/ProfileLink";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function BookmarkRibbonIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  );
}

function MarketPostBookmark({ postKey }: { postKey: string }) {
  const { pinned, toggle, pinning } = usePostPin(postKey);
  return (
    <button
      type="button"
      data-sparkle-click="true"
      className={
        "shrink-0 self-start rounded-full p-2 outline-none transition hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-zinc-800 " +
        (pinned
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-zinc-400 dark:text-zinc-500")
      }
      disabled={pinning}
      aria-pressed={pinned}
      aria-label={pinned ? "Remove bookmark" : "Bookmark this market"}
      title={
        pinned
          ? "Remove bookmark — same as undo Repeak below"
          : "Bookmark — same as Repeak below (saved pins)"
      }
      onClick={() => void toggle()}
    >
      <BookmarkRibbonIcon filled={pinned} />
    </button>
  );
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

function MarketPostCard({
  post,
  isTourAnchor = false,
}: {
  post: MarketPost;
  /** Highlights this card for the first-visit interactive tour. */
  isTourAnchor?: boolean;
}) {
  const pending = Boolean(post.pending);
  const [selected, setSelected] = useState<string | null>(null);
  /** Unlocks tapping the peaksees badge to fetch Peak disagree score */
  const [hasPlacedBet, setHasPlacedBet] = useState(false);
  const [peakScoreRevealed, setPeakScoreRevealed] = useState(false);
  const [peakRefetchNonce, setPeakRefetchNonce] = useState(0);
  const [yes, no] = post.outcomes;
  const yesP = Number(yes?.probability ?? 0.5);
  const cardRef = useRef<HTMLElement | null>(null);
  const peakBadgeRef = useRef<HTMLButtonElement | null>(null);
  const handleSlug = encodeURIComponent(post.handle.replace(/^@/, ""));

  return (
    <article
      data-market-id={post.id}
      data-tour={isTourAnchor ? "tour-first-card" : undefined}
      ref={(el) => {
        cardRef.current = el;
      }}
      data-sparkle-click="true"
      className={
        "poppy-hover sparkle-hover rounded-2xl border border-zinc-200/90 bg-white/[0.97] p-4 shadow-sm backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95 " +
        (pending ? "opacity-90 ring-1 ring-emerald-400/40 motion-safe:animate-pulse" : "")
      }
      aria-label={`Prediction market: ${post.question}`}
    >
      <header className="flex items-start gap-3">
        <ProfileLink
          href={`/p/${handleSlug}`}
          className="group shrink-0"
          ariaLabel={`Open ${post.creator} profile`}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white ring-2 ring-white/30 transition group-hover:scale-[1.03] dark:ring-zinc-700"
            style={{ backgroundColor: `hsl(${post.avatarHue} 55% 42%)` }}
            aria-hidden
          >
            {post.creator
              .split(" ")
              .map((w) => w[0])
              .join("")}
          </div>
        </ProfileLink>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <ProfileLink
              href={`/p/${handleSlug}`}
              className="truncate font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {post.creator}
            </ProfileLink>
            <ProfileLink
              href={`/p/${handleSlug}`}
              className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
            >
              {post.handle}
            </ProfileLink>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{post.postedAt}</span>
            {pending ? (
              <>
                <span className="text-zinc-300 dark:text-zinc-600">·</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                  Finalizing…
                </span>
              </>
            ) : null}
            <span className="text-zinc-300 dark:text-zinc-600">·</span>
            <button
              ref={peakBadgeRef}
              type="button"
              disabled={!hasPlacedBet}
              data-tour={isTourAnchor ? "peak-badge" : undefined}
              data-sparkle-click="true"
              title={
                peakScoreRevealed
                  ? "Tap to refresh Peak’s disagree score"
                  : hasPlacedBet
                    ? "Show Peak’s disagree score"
                    : "Place a Yes or No bet first"
              }
              aria-label={
                peakScoreRevealed
                  ? "Refresh Peak disagree score"
                  : hasPlacedBet
                    ? "Show Peak disagree score"
                    : "Peak insight — place a Yes or No bet first"
              }
              onClick={() => {
                if (!hasPlacedBet) return;
                setPeakScoreRevealed(true);
                setPeakRefetchNonce((n) => n + 1);
                peakBadgeRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                });
                if (
                  typeof navigator !== "undefined" &&
                  navigator.vibrate &&
                  typeof window !== "undefined" &&
                  window.matchMedia("(pointer: coarse)").matches
                ) {
                  navigator.vibrate(10);
                }
              }}
              className={
                "rounded-full px-2 py-0.5 font-medium outline-none ring-offset-2 ring-offset-white transition focus-visible:ring-2 focus-visible:ring-emerald-500 dark:ring-offset-zinc-950 " +
                (peakScoreRevealed
                  ? "cursor-pointer bg-emerald-600/90 text-white hover:bg-emerald-600 ring-1 ring-emerald-500/50 dark:bg-emerald-500 dark:hover:bg-emerald-400"
                  : hasPlacedBet
                    ? "cursor-pointer bg-violet-500/15 text-violet-700 ring-2 ring-violet-400/70 motion-safe:animate-pulse dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/50"
                    : "cursor-not-allowed bg-emerald-500/10 text-emerald-600/65 dark:text-emerald-400/55")
              }
            >
              peaksees
            </button>
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
        <MarketPostBookmark postKey={`market:${post.id}`} />
      </header>

      <h2 className="mt-4 text-[17px] font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50">
        {post.question}
      </h2>
      {Array.isArray(post.hashtags) && post.hashtags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {post.hashtags.slice(0, 6).map((t) => (
            <span
              key={`${post.id}-tag-${t}`}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}

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

      <footer className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <div className="market-ticker">
          <div className="market-ticker__track">
            {[...tickerParts(post), ...tickerParts(post)].map((t, i) => (
              <span key={`${post.id}-tick-${i}`} className="shrink-0">
                <span className="text-zinc-300 dark:text-zinc-600">·</span>{" "}
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">{t}</span>
              </span>
            ))}
          </div>
        </div>
        {selected ? (
          <div className="mt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            You leaned {yes.id === selected ? yes.label : no.label}
          </div>
        ) : null}
      </footer>

      {pending ? (
        <p className="mt-3 rounded-xl border border-emerald-200/80 bg-emerald-500/[0.07] px-3 py-2 text-center text-[12px] font-medium text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200">
          Turning your peak into a market…
        </p>
      ) : (
        <MarketTradeBox
          marketId={`market:${post.id}`}
          yesProbability={yesP}
          onTradeSuccess={() => setHasPlacedBet(true)}
        />
      )}

      {hasPlacedBet && !peakScoreRevealed && !pending ? (
        <p className="mt-3 rounded-xl border border-violet-200/80 bg-violet-500/[0.07] px-3 py-2 text-center text-[12px] font-medium text-violet-800 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-violet-200">
          Tap <span className="font-bold">peaksees</span> at the top of this card to see Peak&apos;s
          disagree score versus the crowd.
        </p>
      ) : null}

      <PeakOpinionChip
        question={post.question}
        crowdYes={yesP}
        enabled={peakScoreRevealed && !pending}
        refetchNonce={peakRefetchNonce}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <ShareMarketButton
          getNode={() => cardRef.current}
          filenameBase={post.question}
          marketId={post.id}
          question={post.question}
        />
      </div>

      <PostActions postKey={`market:${post.id}`} title={post.question} />
    </article>
  );
}

export function PeakFeed({
  posts,
  contextLabel,
  peaks = [],
  tourMarketPostIndex,
}: {
  posts: MarketPost[];
  contextLabel?: string;
  peaks?: Peak[];
  /** Index in `posts` to attach tour spotlight (first market card). */
  tourMarketPostIndex?: number;
}) {
  const tourIx = tourMarketPostIndex ?? -1;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="mx-auto flex w-full max-w-xl flex-col gap-3 px-2 pb-28 pt-5 sm:gap-5 sm:px-4 sm:pb-24 sm:pt-6 md:pt-9">
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
                {peaks.slice(0, 18).map((p) => (
                  <li
                    key={p.id}
                    data-peak-id={p.id}
                    data-sparkle-click="true"
                    className="sparkle-hover sparkle-hover--contained rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <ProfileLink
                        href={`/u/${encodeURIComponent(p.userId)}`}
                        className="font-semibold hover:underline"
                      >
                        {p.displayName}
                      </ProfileLink>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {new Date(p.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-200">
                      {p.text}
                    </p>
                    {p.expiresAt ? (
                      <p className="mt-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        Expires {new Date(p.expiresAt).toLocaleString()}
                      </p>
                    ) : null}
                    <PostActions postKey={`peak:${p.id}`} title={p.text} />
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ) : null}
        {posts.map((post, i) => (
          <li key={post.id}>
            <MarketPostCard post={post} isTourAnchor={i === tourIx} />
          </li>
        ))}
      </ul>
    </div>
  );
}
