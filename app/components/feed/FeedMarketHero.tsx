"use client";

import type { RefObject } from "react";

import { FeedMarketMarquee } from "@/app/components/feed/FeedMarketMarquee";
import type { MarketPost } from "@/app/lib/mock-markets";
import type { MemberPlan } from "@/lib/membership/plans";

export function FeedMarketHero({
  posts,
  viewerUserId,
  viewerMemberPlan,
  onMarketDeleted,
  tourMarketPostIndex,
  viewportRef,
  sentinelRef,
  highlightMarketId,
  onActiveIndexChange,
  exploreLabel,
  loadHint,
  onPullRefresh,
  pullRefreshing,
  pageScrollAtTop,
}: {
  posts: MarketPost[];
  viewerUserId?: string;
  viewerMemberPlan?: MemberPlan;
  onMarketDeleted?: (marketId: string) => void;
  tourMarketPostIndex?: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  highlightMarketId?: string;
  onActiveIndexChange?: (index: number) => void;
  exploreLabel: string;
  loadHint?: string | null;
  onPullRefresh?: () => void | Promise<void>;
  pullRefreshing?: boolean;
  pageScrollAtTop?: boolean;
}) {
  return (
    <section
      className="feed-hero relative w-full shrink-0 overflow-hidden"
      aria-label="Live prediction markets"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/[0.07] via-zinc-100 to-zinc-200/40 dark:from-emerald-500/[0.12] dark:via-zinc-950 dark:to-zinc-900"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-[100rem] px-0">
        <div className="flex items-end justify-between gap-3 px-3 pb-1.5 pt-2 sm:px-4 sm:pt-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
              Markets
            </p>
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              Exploring <span className="font-semibold text-zinc-800 dark:text-zinc-200">{exploreLabel}</span>
              <span className="md:hidden"> · swipe cards · pull down to refresh</span>
              <span className="hidden md:inline"> · swipe or wait for the next card</span>
            </p>
          </div>
          {loadHint ? (
            <p className="shrink-0 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{loadHint}</p>
          ) : null}
        </div>

        <div className="feed-hero__stage h-[min(72dvh,44rem)] min-h-[360px] w-full">
          <FeedMarketMarquee
            posts={posts}
            viewerUserId={viewerUserId}
            viewerMemberPlan={viewerMemberPlan}
            onMarketDeleted={onMarketDeleted}
            tourMarketPostIndex={tourMarketPostIndex}
            viewportRef={viewportRef}
            sentinelRef={sentinelRef}
            highlightMarketId={highlightMarketId}
            onActiveIndexChange={onActiveIndexChange}
            variant="hero"
            onPullRefresh={onPullRefresh}
            pullRefreshing={pullRefreshing}
            pageScrollAtTop={pageScrollAtTop}
          />
        </div>
      </div>
    </section>
  );
}
