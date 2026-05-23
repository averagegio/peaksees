"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { FeedMarketHero } from "@/app/components/feed/FeedMarketHero";
import { FeedSiteSection } from "@/app/components/feed/FeedSiteSection";
import { LiveStreamPanel } from "@/app/components/live/LiveStreamPanel";
import { safeJson } from "@/lib/http";
import type { Peak } from "@/lib/peaks/store";
import type { Market } from "@/lib/markets/store";
import type { MarketPost } from "@/app/lib/mock-markets";
import {
  buildOptimisticMarket,
  buildOptimisticPeak,
  formatMarketPostedAt,
} from "@/app/lib/peak-market";
import Link from "next/link";

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

function replacePendingMarket(prev: Market[], clientId: string, market: Market): Market[] {
  const filtered = prev.filter((m) => m.id !== `pending:${clientId}`);
  return mergeNovelMarkets(filtered, [market]);
}

function dropPendingMarket(prev: Market[], clientId: string): Market[] {
  return prev.filter((m) => m.id !== `pending:${clientId}`);
}

function replacePendingPeak(prev: Peak[], clientId: string, peak: Peak): Peak[] {
  const filtered = prev.filter((p) => p.id !== `pending:${clientId}`);
  return [peak, ...filtered.filter((p) => p.id !== peak.id)].slice(0, 30);
}

/** True when the sentinel is visible inside the scroll root (horizontal feed). */
function scrollRootShowsSentinel(
  scrollRoot: HTMLElement,
  sentinel: HTMLElement,
  marginPastEndPx: number,
): boolean {
  const r = scrollRoot.getBoundingClientRect();
  const s = sentinel.getBoundingClientRect();
  return s.left <= r.right + marginPastEndPx && s.right >= r.left;
}

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
      style={{
        transform: ready ? "rotate(180deg)" : "rotate(0deg)",
      }}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Pull inset: maps drag travel to rail size with light saturation (rubber-band). */
function pullDisplacement(delta: number) {
  const dampened = delta * 0.42;
  return Math.min(96, dampened * (1 + Math.log1p(dampened / 140)));
}

function PullRefreshRail({
  expandedPx,
  loading,
  thresholdPx = 48,
  orientation = "horizontal",
}: {
  expandedPx: number;
  loading: boolean;
  /** Pull distance needed before release triggers refresh. */
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
        "flex shrink-0 items-center justify-center overflow-hidden motion-safe:duration-[240ms] motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] " +
        (isHorizontal
          ? "h-full flex-row bg-gradient-to-r from-emerald-500/[0.06] via-transparent to-transparent pr-2 motion-safe:transition-[width] dark:from-emerald-400/[0.07]"
          : "w-full flex-col bg-gradient-to-b from-emerald-500/[0.06] via-transparent to-transparent pb-2 motion-safe:transition-[height] dark:from-emerald-400/[0.07]")
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
              className="absolute inset-0 h-[46px] w-[46px] -rotate-90 motion-safe:animate-spin motion-safe:[animation-duration:780ms] dark:text-emerald-400 text-emerald-600"
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
              style={{
                opacity: 0.45 + progress * 0.55,
              }}
            >
              <PullRefreshChevron ready={ready} />
            </div>
          </>
        )}
      </div>
      {loading ? (
        <span className="mt-1.5 text-[11px] font-semibold tracking-wide text-emerald-800/90 dark:text-emerald-300/95">
          Refreshing feed…
        </span>
      ) : expandedPx >= 8 ? (
        <span
          className={`mt-1.5 text-[11px] font-medium motion-safe:transition-colors motion-safe:duration-200 ${
            ready
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {ready ? "Release to refresh" : "Pull to refresh"}
        </span>
      ) : null}
    </div>
  );
}

/** Feed tabs hide when scrolling the card rail; older markets load at the end of the row. */
export function HomeFeedWithTabs({
  highlightMarketId,
  highlightPeakId,
  viewerUserId,
}: {
  highlightMarketId?: string;
  highlightPeakId?: string;
  viewerUserId?: string;
} = {}) {
  const [tab, setTab] = useState<"foryou" | "following" | "live">("foryou");
  const [explore, setExplore] = useState("Trending");
  const [showLatestPeaks, setShowLatestPeaks] = useState(
    () => Boolean(highlightPeakId?.trim()),
  );
  const [peaks, setPeaks] = useState<Peak[]>([]);
  const [generatedMarkets, setGeneratedMarkets] = useState<Market[]>([]);
  const [peakMarketMeta, setPeakMarketMeta] = useState<Record<string, PeakMarketMeta>>({});
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [marketsAtEnd, setMarketsAtEnd] = useState(false);
  const [pullOffset, setPullOffset] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollLeftPrev = useRef(0);
  const sparkleLayerRef = useRef<HTMLDivElement>(null);
  const loadArmedRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const feedSessionRef = useRef(0);
  const generatedMarketsRef = useRef<Market[]>([]);
  const marketsAtEndRef = useRef(false);
  const pullOffsetRef = useRef(0);
  const pullGestureRef = useRef<{ active: boolean; startX: number }>({
    active: false,
    startX: 0,
  });
  const tabRef = useRef(tab);
  const lastPullRefreshAtRef = useRef(0);
  const autogenPollRef = useRef<number | null>(null);
  const marqueeIndexRef = useRef(0);

  useEffect(() => {
    return () => {
      if (autogenPollRef.current != null) {
        window.clearTimeout(autogenPollRef.current);
      }
    };
  }, []);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  useEffect(() => {
    pullOffsetRef.current = pullOffset;
  }, [pullOffset]);
  const pullRefreshingRef = useRef(false);
  useEffect(() => {
    pullRefreshingRef.current = pullRefreshing;
  }, [pullRefreshing]);

  useEffect(() => {
    generatedMarketsRef.current = generatedMarkets;
  }, [generatedMarkets]);
  useEffect(() => {
    marketsAtEndRef.current = marketsAtEnd;
  }, [marketsAtEnd]);

  const generatedAsPosts: MarketPost[] = generatedMarkets.map((m) => {
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
    explore === "Trending" ? "" : explore === "News" ? "News" : explore === "Sports" ? "Sports" : "Culture";
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""
      : "";
  const filtersKey = `${tab}:${explore}:${marketCategory}:${tz}`;

  const runPullRefreshRef = useRef<() => Promise<void>>(async () => {});

  const scheduleAutogenFollowUpRef = useRef<(session: number) => void>(() => {});

  scheduleAutogenFollowUpRef.current = (session: number) => {
    if (autogenPollRef.current != null) {
      window.clearTimeout(autogenPollRef.current);
    }

    const pollMs = [1200, 2800];
    let step = 0;

    const pollOnce = () => {
      void (async () => {
        try {
          const href = buildMarketsHref({
            limit: 24,
            autogen: false,
            marketCategory,
            tz,
          });
          const res = await fetch(href, { cache: "no-store" });
          const data = (await safeJson<{ markets?: Market[] }>(res)) ?? {};
          if (session !== feedSessionRef.current) return;
          const incoming = Array.isArray(data.markets) ? data.markets : [];
          let didPrepend = false;
          setGeneratedMarkets((prev) => {
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
        }
        step += 1;
        if (step < pollMs.length && session === feedSessionRef.current) {
          autogenPollRef.current = window.setTimeout(pollOnce, pollMs[step]! - pollMs[step - 1]!);
        } else {
          autogenPollRef.current = null;
        }
      })();
    };

    autogenPollRef.current = window.setTimeout(pollOnce, pollMs[0]!);
  };

  runPullRefreshRef.current = async () => {
    if (tabRef.current === "live") return;
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
      setGeneratedMarkets((prev) => {
        const merged = mergeNovelMarkets(prev, incoming);
        didPrepend = merged !== prev;
        return merged;
      });
      if (didPrepend) {
        marketsAtEndRef.current = false;
        setMarketsAtEnd(false);
      }
      scheduleAutogenFollowUpRef.current(feedSessionRef.current);
    } catch {
      // ignore
    } finally {
      setPullRefreshing(false);
    }
  };

  const appendOlderChunkRef = useRef<() => void>(() => {});

  appendOlderChunkRef.current = () => {
    if (tab === "live") return;
    if (marketsAtEndRef.current) return;
    const gen = generatedMarketsRef.current;
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
        setGeneratedMarkets((prev) => {
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
    const hilite = highlightPeakId?.trim();
    if (hilite) setShowLatestPeaks(true);
  }, [highlightPeakId]);

  useEffect(() => {
    if (!showLatestPeaks) return undefined;
    let cancelled = false;
    const hilite = highlightPeakId?.trim();
    const params = new URLSearchParams();
    params.set("limit", hilite ? "30" : "12");
    if (hilite) params.set("highlight", hilite);
    async function loadPeaks() {
      try {
        const res = await fetch(`/api/peaks?${params}`, { cache: "no-store" });
        const data = (await safeJson<{ peaks?: Peak[] }>(res)) ?? {};
        if (!cancelled && Array.isArray(data.peaks)) setPeaks(data.peaks);
      } catch {
        // ignore
      }
    }
    void loadPeaks();
    return () => {
      cancelled = true;
    };
  }, [showLatestPeaks, highlightPeakId]);

  useEffect(() => {
    if (tab === "live") {
      setGeneratedMarkets([]);
      setMarketsAtEnd(false);
      marketsAtEndRef.current = false;
      loadingMoreRef.current = false;
      setLoadMoreBusy(false);
      return undefined;
    }
    feedSessionRef.current += 1;
    const session = feedSessionRef.current;
    loadArmedRef.current = true;
    marketsAtEndRef.current = false;
    setGeneratedMarkets([]);
    setMarketsAtEnd(false);
    setLoadMoreBusy(false);
    loadingMoreRef.current = false;

    async function boot() {
      try {
        const href = buildMarketsHref({
          limit: 20,
          autogen: true,
          count: 4,
          marketCategory,
          tz,
        });
        const res = await fetch(href, { cache: "no-store" });
        const data = (await safeJson<{ markets?: Market[] }>(res)) ?? {};
        if (session !== feedSessionRef.current) return;
        if (Array.isArray(data.markets)) setGeneratedMarkets(data.markets);
        scheduleAutogenFollowUpRef.current(session);
      } catch {
        // ignore
      }
    }
    void boot();
    return undefined;
  }, [tab, filtersKey, marketCategory, tz]);

  useEffect(() => {
    function onPeakPending(e: Event) {
      const ce = e as CustomEvent;
      const detail = ce.detail as
        | {
            clientId?: string;
            text?: string;
            expiresAt?: string | null;
            createMarket?: boolean;
            user?: {
              id: string;
              displayName: string;
              handle: string;
              avatarHue: number;
            };
          }
        | undefined;
      const clientId = detail?.clientId?.trim();
      const text = typeof detail?.text === "string" ? detail.text.trim() : "";
      const user = detail?.user;
      const createMarket = Boolean(detail?.createMarket);
      if (!clientId || !text || !user) return;

      const peak = buildOptimisticPeak(clientId, {
        text,
        expiresAt: detail?.expiresAt,
        userId: user.id,
        displayName: user.displayName,
        handle: user.handle,
        avatarHue: user.avatarHue,
      });

      setShowLatestPeaks(true);
      setPeaks((prev) => [peak, ...prev.filter((p) => p.id !== peak.id)].slice(0, 30));

      if (createMarket) {
        const market = buildOptimisticMarket(clientId, text);
        setPeakMarketMeta((prev) => ({
          ...prev,
          [market.id]: {
            creator: user.displayName,
            handle: user.handle,
            avatarHue: user.avatarHue,
            postedAt: "Just now",
            profileUserId: user.id,
          },
        }));
        setGeneratedMarkets((prev) => mergeNovelMarkets(prev, [market]));
        marketsAtEndRef.current = false;
        setMarketsAtEnd(false);
      }

      const page = pageScrollRef.current;
      const marquee = scrollRef.current;
      if (page) page.scrollTop = 0;
      if (marquee) marquee.scrollLeft = 0;
    }

    function onNewPeak(e: Event) {
      const ce = e as CustomEvent;
      const detail = ce.detail as
        | { clientId?: string; peak?: Peak; market?: Market }
        | Peak
        | undefined;
      const clientId =
        detail && typeof detail === "object" && "clientId" in detail
          ? detail.clientId?.trim()
          : undefined;
      const peak =
        detail && typeof detail === "object" && "peak" in detail && detail.peak
          ? detail.peak
          : (detail as Peak | undefined);
      const market =
        detail && typeof detail === "object" && "market" in detail ? detail.market : undefined;
      if (!peak || typeof peak !== "object") return;

      setShowLatestPeaks(true);
      setPeaks((prev) =>
        clientId
          ? replacePendingPeak(prev, clientId, peak)
          : [peak, ...prev.filter((p) => p.id !== peak.id)].slice(0, 30),
      );

      if (market && typeof market === "object") {
        setPeakMarketMeta((prev) => {
          const next = { ...prev };
          if (clientId) delete next[`pending:${clientId}`];
          next[market.id] = {
            creator: peak.displayName,
            handle: peak.handle,
            avatarHue: peak.avatarHue,
            postedAt: "Just now",
            profileUserId: peak.userId,
          };
          return next;
        });
        setGeneratedMarkets((prev) =>
          clientId ? replacePendingMarket(prev, clientId, market) : mergeNovelMarkets(prev, [market]),
        );
        marketsAtEndRef.current = false;
        setMarketsAtEnd(false);
        const page = pageScrollRef.current;
        const marquee = scrollRef.current;
        if (page) page.scrollTop = 0;
        if (marquee) marquee.scrollLeft = 0;
      } else if (clientId) {
        setGeneratedMarkets((prev) => dropPendingMarket(prev, clientId));
        setPeakMarketMeta((prev) => {
          const next = { ...prev };
          delete next[`pending:${clientId}`];
          return next;
        });
      }
    }

    function onPeakFailed(e: Event) {
      const ce = e as CustomEvent;
      const clientId = (ce.detail as { clientId?: string } | undefined)?.clientId?.trim();
      if (!clientId) return;
      setGeneratedMarkets((prev) => dropPendingMarket(prev, clientId));
      setPeaks((prev) => prev.filter((p) => p.id !== `pending:${clientId}`));
      setPeakMarketMeta((prev) => {
        const next = { ...prev };
        delete next[`pending:${clientId}`];
        return next;
      });
    }

    window.addEventListener("peaksees:peak-pending", onPeakPending as EventListener);
    window.addEventListener("peaksees:new-peak", onNewPeak as EventListener);
    window.addEventListener("peaksees:peak-failed", onPeakFailed as EventListener);
    return () => {
      window.removeEventListener("peaksees:peak-pending", onPeakPending as EventListener);
      window.removeEventListener("peaksees:new-peak", onNewPeak as EventListener);
      window.removeEventListener("peaksees:peak-failed", onPeakFailed as EventListener);
    };
  }, []);

  useEffect(() => {
    const page = pageScrollRef.current;
    const marquee = scrollRef.current;
    if (page) page.scrollTop = 0;
    if (marquee) marquee.scrollLeft = 0;
    scrollLeftPrev.current = 0;
  }, [tab]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || tab === "live") return undefined;

    const g = pullGestureRef.current;

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshingRef.current) return;
      if (el.scrollLeft > 2) return;
      g.active = true;
      g.startX = e.touches[0].clientX;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!g.active || pullRefreshingRef.current) return;
      if (el.scrollLeft > 2) {
        g.active = false;
        pullOffsetRef.current = 0;
        setPullOffset(0);
        return;
      }
      const dx = e.touches[0].clientX - g.startX;
      if (dx > 0) {
        e.preventDefault();
        const v = pullDisplacement(dx);
        pullOffsetRef.current = v;
        setPullOffset(v);
      }
    };

    const onTouchEnd = () => {
      if (!g.active) return;
      g.active = false;
      const armed = pullOffsetRef.current >= 48;
      pullOffsetRef.current = 0;
      setPullOffset(0);
      if (armed && !pullRefreshingRef.current) void runPullRefreshRef.current();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    let mouseArmed = false;
    let mouseStartX = 0;
    let mousePtrId = -1;

    const ptrDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (pullRefreshingRef.current || el.scrollLeft > 2) return;
      mouseArmed = true;
      mouseStartX = e.clientX;
      mousePtrId = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        mouseArmed = false;
      }
    };

    const ptrMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !mouseArmed || e.pointerId !== mousePtrId) return;
      if (pullRefreshingRef.current || (e.buttons & 1) === 0) return;
      if (el.scrollLeft > 2) {
        mouseArmed = false;
        pullOffsetRef.current = 0;
        setPullOffset(0);
        return;
      }
      const dx = e.clientX - mouseStartX;
      if (dx > 0) {
        e.preventDefault();
        const v = pullDisplacement(dx);
        pullOffsetRef.current = v;
        setPullOffset(v);
      }
    };

    const ptrUp = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !mouseArmed || e.pointerId !== mousePtrId) return;
      mouseArmed = false;
      mousePtrId = -1;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      const armed = pullOffsetRef.current >= 48;
      pullOffsetRef.current = 0;
      setPullOffset(0);
      if (armed && !pullRefreshingRef.current) void runPullRefreshRef.current();
    };

    el.addEventListener("pointerdown", ptrDown);
    el.addEventListener("pointermove", ptrMove, { passive: false });
    el.addEventListener("pointerup", ptrUp);
    el.addEventListener("pointercancel", ptrUp);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("pointerdown", ptrDown);
      el.removeEventListener("pointermove", ptrMove);
      el.removeEventListener("pointerup", ptrUp);
      el.removeEventListener("pointercancel", ptrUp);
    };
  }, [tab]);

  useEffect(() => {
    if (tab === "live") return undefined;

    const root = scrollRef.current;
    const sent = sentinelRef.current;
    if (!root || !sent) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        const en = entries[0];
        if (!en) return;

        if (!en.isIntersecting) {
          loadArmedRef.current = true;
          return;
        }

        appendOlderChunkRef.current();
      },
      { root, rootMargin: "0px 160px 0px 0px", threshold: 0 },
    );

    io.observe(sent);
    return () => io.disconnect();
  }, [tab, filtersKey]);

  // After the first batch arrives, IO may never re-fire while the sentinel stays in view.
  useEffect(() => {
    if (tab === "live" || generatedMarkets.length === 0) return undefined;

    const root = scrollRef.current;
    const sent = sentinelRef.current;
    if (!root || !sent) return undefined;

    const id = window.requestAnimationFrame(() => {
      if (marketsAtEndRef.current || loadingMoreRef.current) return;
      if (!scrollRootShowsSentinel(root, sent, 160)) return;
      loadArmedRef.current = true;
      appendOlderChunkRef.current();
    });

    return () => window.cancelAnimationFrame(id);
  }, [generatedMarkets.length, tab, filtersKey]);

  useEffect(() => {
    const marketId = highlightMarketId?.trim();
    const peakId = highlightPeakId?.trim();
    if (!marketId && !peakId) return undefined;
    const timer = window.setTimeout(() => {
      const root = scrollRef.current;
      if (!root || typeof CSS === "undefined" || typeof CSS.escape !== "function") return;
      try {
        if (marketId) {
          const el = root.querySelector(`[data-market-id="${CSS.escape(marketId)}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        } else if (peakId) {
          const el = root.querySelector(`[data-peak-id="${CSS.escape(peakId)}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      } catch {
        // ignore
      }
    }, peakId ? 320 : 120);
    return () => window.clearTimeout(timer);
  }, [highlightMarketId, highlightPeakId, tab, explore, peaks, generatedMarkets]);

  useEffect(() => {
    function spawnSparkles(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-sparkle-click='true']")) return;
      const host = sparkleLayerRef.current;
      if (!host) return;

      for (let i = 0; i < 6; i += 1) {
        const star = document.createElement("span");
        star.className = "click-star";
        const angle = (Math.PI * 2 * i) / 6;
        const distance = 10 + Math.random() * 16;
        star.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
        star.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
        star.style.left = `${event.clientX}px`;
        star.style.top = `${event.clientY}px`;
        star.textContent = i % 2 === 0 ? "✦" : "✧";
        host.appendChild(star);
        window.setTimeout(() => star.remove(), 560);
      }
    }

    window.addEventListener("click", spawnSparkles, { passive: true });
    return () => window.removeEventListener("click", spawnSparkles);
  }, []);

  const feedPosts = dedupePostsById(generatedAsPosts);

  const onMarqueeIndexChange = useCallback(
    (index: number) => {
      marqueeIndexRef.current = index;
      if (tabRef.current === "live" || marketsAtEndRef.current) return;
      if (index < Math.max(0, feedPosts.length - 2)) return;
      if (!loadArmedRef.current || loadingMoreRef.current) return;
      appendOlderChunkRef.current();
    },
    [feedPosts.length],
  );

  const loadHint =
    tab !== "live"
      ? loadMoreBusy
        ? "Loading more…"
        : marketsAtEnd
          ? "You're up to date"
          : null
      : null;

  return (
    <div className="flex min-h-0 w-full max-w-none flex-1 flex-col">
      <div ref={sparkleLayerRef} className="pointer-events-none fixed inset-0 z-[120]" />

      <header className="relative z-20 shrink-0 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 sm:px-6">
          <div
            role="tablist"
            aria-label="Feed tabs"
            data-tour="feed-tabs"
            className="feed-scroll mx-auto flex w-full max-w-md gap-1 overflow-x-auto rounded-full border border-zinc-200/80 bg-zinc-50/90 p-1 dark:border-zinc-700 dark:bg-zinc-900/80"
          >
            <FeedTabButton
              active={tab === "foryou"}
              onClick={() => setTab("foryou")}
            >
              For you
            </FeedTabButton>
            <FeedTabButton
              active={tab === "following"}
              onClick={() => setTab("following")}
            >
              Following
            </FeedTabButton>
            <FeedTabButton
              active={tab === "live"}
              onClick={() => setTab("live")}
            >
              Live
            </FeedTabButton>
          </div>

          <div
            data-tour="feed-explore"
            className="feed-scroll mt-3 flex items-center justify-center gap-4 overflow-x-auto pb-0.5"
          >
              {["Trending", "News", "Sports", "Culture"].map((item) => {
                const color =
                  item === "Trending"
                    ? "text-emerald-700 dark:text-emerald-300"
                    : item === "News"
                      ? "text-sky-700 dark:text-sky-300"
                      : item === "Sports"
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-violet-700 dark:text-violet-300";
                const inactive =
                  item === "Trending"
                    ? "text-emerald-700/60 hover:text-emerald-800 dark:text-emerald-300/65 dark:hover:text-emerald-200"
                    : item === "News"
                      ? "text-sky-700/60 hover:text-sky-800 dark:text-sky-300/65 dark:hover:text-sky-200"
                      : item === "Sports"
                        ? "text-amber-700/60 hover:text-amber-800 dark:text-amber-300/65 dark:hover:text-amber-200"
                        : "text-violet-700/60 hover:text-violet-800 dark:text-violet-300/65 dark:hover:text-violet-200";
                return (
                <button
                  key={item}
                  type="button"
                  data-sparkle-click="true"
                  onClick={() => setExplore(item)}
                  className={`group sparkle-hover sparkle-hover--contained nav-chip-motion shrink-0 rounded-none px-0 py-0.5 text-[12px] font-semibold tracking-tight transition sm:text-[13px] ${
                    explore === item
                      ? color
                      : inactive
                  }`}
                >
                  <span className="sr-only">{item}</span>
                  <span
                    className="slot-roll"
                    data-slot-speed={
                      item === "Trending"
                        ? "fast"
                        : item === "News"
                          ? "med"
                          : item === "Sports"
                            ? "slow"
                            : "med"
                    }
                    aria-hidden
                  >
                    <span className="slot-roll__inner">
                      <span>{item}</span>
                      <span>{item}</span>
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`mt-1 block h-[2px] w-full rounded-full transition ${
                      explore === item
                        ? "bg-current/70"
                        : "bg-transparent"
                    }`}
                  />
                </button>
                );
              })}
              <Link
                href="/peakstats"
                data-sparkle-click="true"
                className="group sparkle-hover sparkle-hover--contained nav-chip-motion shrink-0 px-0 py-0.5 text-[12px] font-semibold tracking-tight text-fuchsia-700/65 transition hover:text-fuchsia-800 sm:text-[13px] dark:text-fuchsia-300/70 dark:hover:text-fuchsia-200"
              >
                <span className="sr-only">Peakstats</span>
                <span className="slot-roll" data-slot-speed="slow" aria-hidden>
                  <span className="slot-roll__inner">
                    <span>Peakstats</span>
                    <span>Peakstats</span>
                  </span>
                </span>
                <span aria-hidden className="mt-1 block h-[2px] w-full rounded-full bg-transparent group-hover:bg-current/35" />
              </Link>
          </div>

          <div className="mt-3 flex justify-center">
            <button
              type="button"
              data-sparkle-click="true"
              onClick={() => {
                setShowLatestPeaks((v) => !v);
                if (showLatestPeaks) setPeaks([]);
              }}
              className="text-[11px] font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              {showLatestPeaks ? "Hide latest peaks" : "Show latest peaks"}
            </button>
          </div>
        </div>
      </header>

      {showLatestPeaks && peaks.length > 0 ? (
        <div className="feed-scroll shrink-0 overflow-x-auto border-b border-zinc-200/70 bg-zinc-50/90 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <ul className="mx-auto flex max-w-4xl gap-3">
            {peaks.slice(0, 10).map((p) => (
              <li key={p.id} className="shrink-0">
                <Link
                  href={`/u/${encodeURIComponent(p.userId)}?peak=${encodeURIComponent(p.id)}`}
                  data-peak-id={p.id}
                  className="block w-[min(70vw,18rem)] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm transition hover:border-emerald-400/80 hover:bg-emerald-50/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:border-emerald-600/60 dark:hover:bg-emerald-950/30"
                >
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {p.displayName}
                  </span>
                  <p className="mt-1 line-clamp-2 text-zinc-600 dark:text-zinc-300">{p.text}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        ref={pageScrollRef}
        className="feed-scroll feed-page-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain"
        data-tour="feed-scroll"
      >
        {tab === "live" ? (
          <section className="feed-hero relative w-full shrink-0 overflow-hidden">
            <div className="feed-hero__stage flex h-[min(38dvh,24rem)] min-h-[200px] w-full items-stretch px-4 py-4 sm:px-6 sm:py-5">
              <div className="h-full w-full overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-900/95">
                <LiveStreamPanel compact />
              </div>
            </div>
          </section>
        ) : (
          <div className="relative w-full">
            {pullOffset > 0 || pullRefreshing ? (
              <div className="absolute left-0 top-[4.5rem] z-30 flex h-[calc(min(54dvh,34rem)-4.5rem)] items-center sm:top-[5rem]">
                <PullRefreshRail
                  orientation="horizontal"
                  expandedPx={pullOffset}
                  loading={pullRefreshing}
                />
              </div>
            ) : null}
            <FeedMarketHero
              key={`${tab}-${explore}`}
              posts={feedPosts}
              viewerUserId={viewerUserId}
              tourMarketPostIndex={0}
              viewportRef={scrollRef}
              sentinelRef={sentinelRef}
              highlightMarketId={highlightMarketId}
              onActiveIndexChange={onMarqueeIndexChange}
              exploreLabel={explore}
              loadHint={loadHint}
            />
          </div>
        )}

        <FeedSiteSection />
      </div>
    </div>
  );
}
