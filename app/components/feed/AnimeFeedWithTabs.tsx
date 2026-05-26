"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { FeedMarketHero } from "@/app/components/feed/FeedMarketHero";
import { FeedSiteSection } from "@/app/components/feed/FeedSiteSection";
import { safeJson } from "@/lib/http";
import type { Market } from "@/lib/markets/store";
import type { MarketPost } from "@/app/lib/mock-markets";
import {
  formatMarketPostedAt,
} from "@/app/lib/peak-market";

function dedupePostsById(posts: MarketPost[]): MarketPost[] {
  const seen = new Set<string>();
  const out: MarketPost[] = [];
  for (const p of posts) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

function FeedTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-sparkle-click="true"
      className={`poppy-hover sparkle-hover sparkle-hover--contained min-h-7 flex-1 rounded-full px-2 py-0.5 text-[11px] font-medium outline-none ring-emerald-500/35 transition focus-visible:ring-2 sm:min-h-8 sm:py-1 sm:text-[12px] ${
        active
          ? "bg-white text-zinc-900 shadow-sm shadow-zinc-300/40 dark:bg-zinc-800 dark:text-emerald-300 dark:shadow-black/45"
          : "text-zinc-600 hover:bg-zinc-100/90 dark:text-zinc-400 dark:hover:bg-zinc-800/92"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function buildMarketsHref(opts: {
  limit: number;
  autogen: boolean;
  count?: number;
  marketCategory: string;
  tz: string;
  cursor?: { createdAt: string; id: string };
}) {
  const q = new URLSearchParams();
  q.set("limit", String(opts.limit));
  if (opts.autogen) {
    q.set("autogen", "1");
    q.set("count", String(opts.count ?? 5));
  }
  if (opts.marketCategory) q.set("category", opts.marketCategory);
  q.set("subcategory", "anime");
  if (opts.tz) q.set("tz", opts.tz);
  if (opts.cursor) {
    q.set("cursorCreatedAt", opts.cursor.createdAt);
    q.set("cursorId", opts.cursor.id);
  }
  return `/api/markets?${q}`;
}

type PeakMarketMeta = {
  creator: string;
  handle: string;
  avatarHue: number;
  postedAt: string;
  profileUserId?: string;
};

function mergeNovelMarkets(prev: Market[], incoming: Market[]): Market[] {
  const seen = new Set(prev.map((m) => m.id));
  const novel = incoming.filter((m) => !seen.has(m.id));
  if (novel.length === 0) return prev;
  return [...novel, ...prev];
}

function scrollRootShowsSentinel(
  scrollRoot: HTMLElement,
  sentinel: HTMLElement,
  marginPastEndPx: number,
): boolean {
  const r = scrollRoot.getBoundingClientRect();
  const s = sentinel.getBoundingClientRect();
  return s.left <= r.right + marginPastEndPx && s.right >= r.left;
}

/** Anime feed with category tabs: Trending, News, Sports, Culture */
export function AnimeFeedWithTabs({
  viewerUserId,
}: {
  viewerUserId?: string;
} = {}) {
  const [category, setCategory] = useState("Trending");
  const [markets, setMarkets] = useState<Market[]>([]);
  const [peakMarketMeta, setPeakMarketMeta] = useState<Record<string, PeakMarketMeta>>({});
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [marketsAtEnd, setMarketsAtEnd] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [pageScrollAtTop, setPageScrollAtTop] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollLeftPrev = useRef(0);
  const sparkleLayerRef = useRef<HTMLDivElement>(null);
  const loadArmedRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const feedSessionRef = useRef(0);
  const marketsRef = useRef<Market[]>([]);
  const marketsAtEndRef = useRef(false);
  const categoryRef = useRef(category);
  const lastPullRefreshAtRef = useRef(0);

  useEffect(() => {
    categoryRef.current = category;
  }, [category]);

  useEffect(() => {
    marketsRef.current = markets;
  }, [markets]);

  useEffect(() => {
    marketsAtEndRef.current = marketsAtEnd;
  }, [marketsAtEnd]);

  const generatedAsPosts: MarketPost[] = markets.map((m) => {
    const yesP = Number(m.yesProbability) || 0.5;
    const noP = Number(m.noProbability) || 1 - yesP;
    const meta = peakMarketMeta[m.id];
    const isPending = m.id.startsWith("pending:");
    return {
      id: m.id.startsWith("market:") ? m.id.slice("market:".length) : m.id,
      creator: meta?.creator ?? "Peak AI",
      handle: meta?.handle ?? "@peak",
      avatarHue: meta?.avatarHue ?? 160,
      postedAt: meta?.postedAt ?? (isPending ? "Just now" : formatMarketPostedAt(m.createdAt)),
      question: m.question,
      category: m.category,
      subcategory: m.subcategory || undefined,
      hashtags: Array.isArray(m.hashtags) && m.hashtags.length ? m.hashtags : undefined,
      volumeUsd: Math.round((m.volumeCents ?? 0) / 100),
      endsAtLabel: m.endsAt,
      pending: isPending,
      profileUserId: meta?.profileUserId,
      marketSource: m.source,
      outcomes: [
        { id: "y", label: "Yes", probability: yesP },
        { id: "n", label: "No", probability: noP },
      ],
    };
  });

  const marketCategory =
    category === "Trending" ? "" : category === "News" ? "News" : category === "Sports" ? "Sports" : "Culture";
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""
      : "";
  const filtersKey = `anime:${category}:${marketCategory}:${tz}`;

  const runPullRefreshRef = useRef<() => Promise<void>>(async () => {});

  runPullRefreshRef.current = async () => {
    const nowTick = Date.now();
    if (nowTick - lastPullRefreshAtRef.current < 2200) return;
    lastPullRefreshAtRef.current = nowTick;

    setPullRefreshing(true);
    try {
      const href = buildMarketsHref({
        limit: 24,
        autogen: true,
        count: 4,
        marketCategory,
        tz,
      });
      const res = await fetch(href, { cache: "no-store" });
      const data = (await safeJson<{ markets?: Market[] }>(res)) ?? {};
      const incoming = Array.isArray(data.markets) ? data.markets : [];

      let didPrepend = false;
      setMarkets((prev) => {
        const merged = mergeNovelMarkets(prev, incoming);
        didPrepend = merged !== prev;
        return merged;
      });
      if (didPrepend) {
        marketsAtEndRef.current = false;
        setMarketsAtEnd(false);
      }
    } catch {
      // ignore
    } finally {
      setPullRefreshing(false);
    }
  };

  const appendOlderChunkRef = useRef<() => void>(() => {});

  appendOlderChunkRef.current = () => {
    if (marketsAtEndRef.current) return;
    const gen = marketsRef.current;
    if (!gen.length || !loadArmedRef.current) return;
    if (loadingMoreRef.current) return;

    const session = feedSessionRef.current;
    const last = gen[gen.length - 1];

    loadArmedRef.current = false;
    loadingMoreRef.current = true;
    setLoadMoreBusy(true);

    void (async () => {
      try {
        const href = buildMarketsHref({
          limit: 14,
          autogen: false,
          marketCategory,
          tz,
          cursor: { createdAt: last.createdAt, id: last.id },
        });
        const res = await fetch(href, { cache: "no-store" });
        const data = (await safeJson<{ markets?: Market[] }>(res)) ?? {};
        if (session !== feedSessionRef.current) {
          loadingMoreRef.current = false;
          setLoadMoreBusy(false);
          loadArmedRef.current = true;
          return;
        }

        const chunk = Array.isArray(data.markets) ? data.markets : [];

        loadingMoreRef.current = false;
        setLoadMoreBusy(false);

        let drained = false;
        setMarkets((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = chunk.filter((m) => !seen.has(m.id));
          drained = merged.length === 0;
          if (drained) return prev;
          return [...prev, ...merged];
        });
        marketsAtEndRef.current = drained;
        setMarketsAtEnd(drained);
      } catch {
        loadingMoreRef.current = false;
        setLoadMoreBusy(false);
        loadArmedRef.current = true;
      }
    })();
  };

  useEffect(() => {
    feedSessionRef.current += 1;
    const session = feedSessionRef.current;
    loadArmedRef.current = true;
    marketsAtEndRef.current = false;
    setMarkets([]);
    setLoadMoreBusy(false);
    setPullRefreshing(false);
    lastPullRefreshAtRef.current = 0;

    void (async () => {
      try {
        const href = buildMarketsHref({
          limit: 24,
          autogen: true,
          count: 6,
          marketCategory,
          tz,
        });
        const res = await fetch(href, { cache: "no-store" });
        const data = (await safeJson<{ markets?: Market[] }>(res)) ?? {};
        if (session !== feedSessionRef.current) return;
        const incoming = Array.isArray(data.markets) ? data.markets : [];
        setMarkets(incoming);
      } catch {
        // ignore
      }
    })();
  }, [filtersKey]);

  const onPageScroll = useCallback((e: Event) => {
    const el = e.currentTarget as HTMLElement;
    const atTop = el.scrollTop < 60;
    if (atTop !== pageScrollAtTop) {
      setPageScrollAtTop(atTop);
    }
    const sentinel = sentinelRef.current;
    const scroll = scrollRef.current;
    if (sentinel && scroll && scrollRootShowsSentinel(scroll, sentinel, 300)) {
      appendOlderChunkRef.current();
    }
  }, [pageScrollAtTop]);

  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el) return undefined;
    el.addEventListener("scroll", onPageScroll, { passive: true });
    return () => el.removeEventListener("scroll", onPageScroll);
  }, [onPageScroll]);

  const onPullRefresh = useCallback(() => {
    void runPullRefreshRef.current();
  }, []);

  return (
    <>
      <div className="relative z-20 border-b border-zinc-100 bg-white px-2 py-2 dark:border-zinc-800 dark:bg-zinc-950 sm:px-3">
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-zinc-100/80 p-1 dark:bg-zinc-800">
          {(["Trending", "News", "Sports", "Culture"] as const).map((opt) => (
            <FeedTabButton
              key={opt}
              active={category === opt}
              onClick={() => setCategory(opt)}
            >
              {opt}
            </FeedTabButton>
          ))}
        </div>
      </div>

      <div
        ref={pageScrollRef}
        className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"
      >
        <div className="relative z-10 w-full flex-1">
          {generatedAsPosts.length > 0 ? (
            <FeedMarketHero
              key={filtersKey}
              posts={dedupePostsById(generatedAsPosts)}
              viewerUserId={viewerUserId}
              tourMarketPostIndex={0}
              viewportRef={scrollRef}
              sentinelRef={sentinelRef}
              exploreLabel={category}
              loadHint={
                loadMoreBusy
                  ? "Loading more…"
                  : marketsAtEnd
                    ? "You're up to date"
                    : null
              }
              onPullRefresh={onPullRefresh}
              pullRefreshing={pullRefreshing}
              pageScrollAtTop={pageScrollAtTop}
              onActiveIndexChange={(index) => {
                const len = dedupePostsById(generatedAsPosts).length;
                if (index < Math.max(0, len - 2)) return;
                if (!loadArmedRef.current || loadingMoreRef.current) return;
                appendOlderChunkRef.current();
              }}
            />
          ) : null}

          <FeedSiteSection />
        </div>
      </div>
    </>
  );
}
