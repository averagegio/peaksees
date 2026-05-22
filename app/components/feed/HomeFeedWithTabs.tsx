"use client";

import { useEffect, useRef, useState } from "react";

import { PeakFeed } from "@/app/components/PeakFeed";
import { LiveStreamPanel } from "@/app/components/live/LiveStreamPanel";
import {
  MARKET_FEED_FOLLOWING,
  MARKET_FEED_FOR_YOU,
  MARKET_FEED_LIVE,
} from "@/app/lib/mock-markets";
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

function dedupePostsByMarketId(generated: MarketPost[], filler: MarketPost[]): MarketPost[] {
  const seen = new Set<string>();
  const out: MarketPost[] = [];
  for (const p of generated) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  for (const p of filler) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/** Prefer real generated markets; mock filler only when the feed is still sparse. */
function buildFeedPosts(generated: MarketPost[], filler: MarketPost[]): MarketPost[] {
  if (generated.length >= 2) return generated;
  return dedupePostsByMarketId(generated, filler);
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
      className={`poppy-hover sparkle-hover sparkle-hover--contained min-h-8 flex-1 rounded-full px-2.5 py-1 text-[12px] font-medium outline-none ring-emerald-500/35 transition focus-visible:ring-2 sm:py-1.5 sm:text-[13px] ${
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

/** True when the sentinel overlaps the scroll root viewport (within bottom margin). */
function scrollRootShowsSentinel(
  scrollRoot: HTMLElement,
  sentinel: HTMLElement,
  marginPastBottomPx: number,
): boolean {
  const r = scrollRoot.getBoundingClientRect();
  const s = sentinel.getBoundingClientRect();
  return s.top <= r.bottom + marginPastBottomPx && s.bottom >= r.top;
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

/** Pull inset: maps finger travel to rail height with light saturation (rubber-band). */
function pullDisplacement(dy: number) {
  const dampened = dy * 0.42;
  return Math.min(96, dampened * (1 + Math.log1p(dampened / 140)));
}

function PullRefreshRail({
  expandedPx,
  loading,
  thresholdPx = 48,
}: {
  expandedPx: number;
  loading: boolean;
  /** Pull distance needed before release triggers refresh. */
  thresholdPx?: number;
}) {
  const maxProgressPx = 80;
  const h = loading ? 78 : expandedPx;
  if (h < 2 && !loading) return null;
  const progress = loading ? 1 : Math.min(1, expandedPx / maxProgressPx);
  const ready = !loading && expandedPx >= thresholdPx;
  const railR = 15;
  const circ = 2 * Math.PI * railR;

  return (
    <div
      role={loading ? "status" : undefined}
      aria-live={loading ? "polite" : undefined}
      aria-busy={loading || undefined}
      data-pull-rail=""
      className="flex w-full shrink-0 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-emerald-500/[0.06] via-transparent to-transparent pb-2 motion-safe:transition-[height] motion-safe:duration-[240ms] motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)] dark:from-emerald-400/[0.07]"
      style={{ height: h }}
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

function FeedInfiniteFooter({ loading, end }: { loading: boolean; end: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-none flex-col px-2 pb-28 pt-4 sm:px-4">
      <div className="flex min-h-[3.25rem] flex-col items-center justify-center gap-2 pb-8">
        {end ? (
          <p className="text-center text-[12px] text-zinc-500 dark:text-zinc-400">
            You&apos;re up to date for now
          </p>
        ) : loading ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading more"
            className="flex flex-col items-center gap-2"
          >
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600 dark:border-zinc-600 dark:border-t-emerald-400"
              aria-hidden
            />
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Loading more</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Feed tabs hide on scroll down; older market cards load as you scroll (infinite feed). */
export function HomeFeedWithTabs({
  highlightMarketId,
  highlightPeakId,
}: {
  highlightMarketId?: string;
  highlightPeakId?: string;
} = {}) {
  const [tab, setTab] = useState<"foryou" | "following" | "live">("foryou");
  const [explore, setExplore] = useState("Trending");
  const [showLatestPeaks, setShowLatestPeaks] = useState(
    () => Boolean(highlightPeakId?.trim()),
  );
  const [tabsVisible, setTabsVisible] = useState(true);
  const [peaks, setPeaks] = useState<Peak[]>([]);
  const [generatedMarkets, setGeneratedMarkets] = useState<Market[]>([]);
  const [peakMarketMeta, setPeakMarketMeta] = useState<Record<string, PeakMarketMeta>>({});
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [marketsAtEnd, setMarketsAtEnd] = useState(false);
  const [pullOffset, setPullOffset] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollTopPrev = useRef(0);
  const sparkleLayerRef = useRef<HTMLDivElement>(null);
  const loadArmedRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const feedSessionRef = useRef(0);
  const generatedMarketsRef = useRef<Market[]>([]);
  const marketsAtEndRef = useRef(false);
  const pullOffsetRef = useRef(0);
  const pullGestureRef = useRef<{ active: boolean; startY: number }>({
    active: false,
    startY: 0,
  });
  const tabRef = useRef(tab);
  const lastPullRefreshAtRef = useRef(0);
  const autogenPollRef = useRef<number | null>(null);

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

  const posts =
    tab === "foryou"
      ? MARKET_FEED_FOR_YOU
      : tab === "following"
        ? MARKET_FEED_FOLLOWING
        : MARKET_FEED_LIVE;

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
          },
        }));
        setGeneratedMarkets((prev) => mergeNovelMarkets(prev, [market]));
        marketsAtEndRef.current = false;
        setMarketsAtEnd(false);
      }

      const root = scrollRef.current;
      if (root) root.scrollTop = 0;
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
          };
          return next;
        });
        setGeneratedMarkets((prev) =>
          clientId ? replacePendingMarket(prev, clientId, market) : mergeNovelMarkets(prev, [market]),
        );
        marketsAtEndRef.current = false;
        setMarketsAtEnd(false);
        const root = scrollRef.current;
        if (root) root.scrollTop = 0;
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
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    scrollTopPrev.current = 0;
  }, [tab]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    const onScroll = () => {
      const t = Math.max(0, el.scrollTop);
      if (t < 16) setTabsVisible(true);
      else if (t > scrollTopPrev.current + 6) setTabsVisible(false);
      else if (t + 6 < scrollTopPrev.current) setTabsVisible(true);
      scrollTopPrev.current = t;
    };

    scrollTopPrev.current = el.scrollTop;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || tab === "live") return undefined;

    const g = pullGestureRef.current;

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshingRef.current) return;
      if (el.scrollTop > 2) return;
      g.active = true;
      g.startY = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!g.active || pullRefreshingRef.current) return;
      if (el.scrollTop > 2) {
        g.active = false;
        pullOffsetRef.current = 0;
        setPullOffset(0);
        return;
      }
      const dy = e.touches[0].clientY - g.startY;
      if (dy > 0) {
        e.preventDefault();
        const v = pullDisplacement(dy);
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
    let mouseStartY = 0;
    let mousePtrId = -1;

    const ptrDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (pullRefreshingRef.current || el.scrollTop > 2) return;
      mouseArmed = true;
      mouseStartY = e.clientY;
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
      if (el.scrollTop > 2) {
        mouseArmed = false;
        pullOffsetRef.current = 0;
        setPullOffset(0);
        return;
      }
      const dy = e.clientY - mouseStartY;
      if (dy > 0) {
        e.preventDefault();
        const v = pullDisplacement(dy);
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
      { root, rootMargin: "140px", threshold: 0 },
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
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (peakId) {
          const el = root.querySelector(`[data-peak-id="${CSS.escape(peakId)}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  useEffect(() => {
    function showTourChrome() {
      setTabsVisible(true);
    }
    window.addEventListener("peaksees:tour-show-feed-chrome", showTourChrome);
    return () => window.removeEventListener("peaksees:tour-show-feed-chrome", showTourChrome);
  }, []);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col">
      <div ref={sparkleLayerRef} className="pointer-events-none fixed inset-0 z-[120]" />
      <section
        className={`shrink-0 overflow-hidden border-b border-zinc-200/65 transition-[max-height,padding,opacity,margin] duration-[320ms] ease-out dark:border-zinc-800 ${
          tabsVisible
            ? "pointer-events-auto max-h-48 opacity-100"
            : "pointer-events-none max-h-0 border-transparent opacity-0"
        }`}
        aria-hidden={!tabsVisible}
      >
        <div className="px-3 py-2 sm:px-4">
          <div
            role="tablist"
            aria-label="Feed tabs"
            data-tour="feed-tabs"
            className="feed-scroll mx-auto flex w-full max-w-[25rem] gap-px overflow-x-auto rounded-full border border-zinc-200/75 bg-white/90 p-[2px] shadow-sm backdrop-blur-sm dark:border-zinc-700/85 dark:bg-zinc-900/80"
          >
            <FeedTabButton
              active={tab === "foryou"}
              onClick={() => {
                setTab("foryou");
                setTabsVisible(true);
              }}
            >
              For you
            </FeedTabButton>
            <FeedTabButton
              active={tab === "following"}
              onClick={() => {
                setTab("following");
                setTabsVisible(true);
              }}
            >
              Following
            </FeedTabButton>
            <FeedTabButton
              active={tab === "live"}
              onClick={() => {
                setTab("live");
                setTabsVisible(true);
              }}
            >
              Live
            </FeedTabButton>
          </div>
          <div className="mx-auto mt-3 max-w-lg border-t border-zinc-200/80 pt-3 dark:border-zinc-800">
            <div
              data-tour="feed-explore"
              className="-mx-3 feed-scroll flex items-center gap-4 overflow-x-auto px-3 pb-1"
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
                  className={`group sparkle-hover sparkle-hover--contained nav-chip-motion shrink-0 rounded-none px-0 py-1 text-[13px] font-semibold tracking-tight transition ${
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
                className="group sparkle-hover sparkle-hover--contained nav-chip-motion shrink-0 px-0 py-1 text-[13px] font-semibold tracking-tight text-fuchsia-700/65 transition hover:text-fuchsia-800 dark:text-fuchsia-300/70 dark:hover:text-fuchsia-200"
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-sparkle-click="true"
                onClick={() => {
                  setShowLatestPeaks((v) => !v);
                  if (showLatestPeaks) setPeaks([]);
                }}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {showLatestPeaks ? "Hide latest peaks" : "Show latest peaks"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div
        ref={scrollRef}
        data-tour="feed-scroll"
        className="feed-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-pt-4 sm:scroll-pt-6"
      >
        {tab !== "live" ? (
          <PullRefreshRail expandedPx={pullOffset} loading={pullRefreshing} />
        ) : null}
        {tab === "live" ? <LiveStreamPanel /> : null}
        <PeakFeed
          key={`${tab}-${explore}`}
          posts={buildFeedPosts(generatedAsPosts, posts)}
          contextLabel={explore}
          peaks={showLatestPeaks ? peaks : []}
          tourMarketPostIndex={0}
        />
        {tab !== "live" ? (
          <div ref={sentinelRef} className="w-full shrink-0" aria-hidden={false}>
            <FeedInfiniteFooter loading={loadMoreBusy} end={marketsAtEnd} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
