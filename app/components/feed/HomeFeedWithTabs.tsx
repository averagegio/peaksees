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
import Link from "next/link";

/** Real markets and mock timelines can share the same `MarketPost.id` (e.g. `"4"`); merge must stay key-unique for React. */
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
  activeSubcat: string;
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
  if (opts.activeSubcat) q.set("subcategory", opts.activeSubcat);
  if (opts.tz) q.set("tz", opts.tz);
  if (opts.cursor) {
    q.set("cursorCreatedAt", opts.cursor.createdAt);
    q.set("cursorId", opts.cursor.id);
  }
  return `/api/markets?${q}`;
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
  const [subcat, setSubcat] = useState<string>("");
  const [showLatestPeaks, setShowLatestPeaks] = useState(
    () => Boolean(highlightPeakId?.trim()),
  );
  const [tabsVisible, setTabsVisible] = useState(true);
  const [peaks, setPeaks] = useState<Peak[]>([]);
  const [generatedMarkets, setGeneratedMarkets] = useState<Market[]>([]);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [marketsAtEnd, setMarketsAtEnd] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollTopPrev = useRef(0);
  const sparkleLayerRef = useRef<HTMLDivElement>(null);
  const loadArmedRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const feedSessionRef = useRef(0);
  const generatedMarketsRef = useRef<Market[]>([]);
  const marketsAtEndRef = useRef(false);

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
    return {
      id: m.id.startsWith("market:") ? m.id.slice("market:".length) : m.id,
      creator: "Peak AI",
      handle: "@peak",
      avatarHue: 160,
      postedAt: "Today",
      question: m.question,
      category: m.category,
      subcategory: m.subcategory || undefined,
      hashtags: Array.isArray(m.hashtags) && m.hashtags.length ? m.hashtags : undefined,
      volumeUsd: Math.round((m.volumeCents ?? 0) / 100),
      endsAtLabel: m.endsAt,
      outcomes: [
        { id: "y", label: "Yes", probability: yesP },
        { id: "n", label: "No", probability: noP },
      ],
    };
  });

  const marketCategory =
    explore === "Trending" ? "" : explore === "News" ? "News" : explore === "Sports" ? "Sports" : "Culture";
  const allowedSubcats =
    explore === "News"
      ? ["politics", "econ", "global", "eu", "tech", "science", "commodities", "ai"]
      : explore === "Sports"
        ? ["nba", "nfl", "wnba", "soccer", "hockey", "golf", "olympics", "niche"]
        : explore === "Culture"
          ? ["celebs", "fashion", "music", "events", "local", "tv", "streaming", "netflix", "art"]
          : [];
  const activeSubcat = allowedSubcats.includes(subcat) ? subcat : "";
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""
      : "";
  const filtersKey = `${tab}:${explore}:${marketCategory}:${activeSubcat}:${tz}`;

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
          activeSubcat,
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
    // Reset subcategory when switching nav chips.
    if (allowedSubcats.length === 0) {
      setSubcat("");
      return;
    }
    setSubcat((prev) => (allowedSubcats.includes(prev) ? prev : allowedSubcats[0] ?? ""));
  }, [explore]);

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
          count: 5,
          marketCategory,
          activeSubcat,
          tz,
        });
        const res = await fetch(href, { cache: "no-store" });
        const data = (await safeJson<{ markets?: Market[] }>(res)) ?? {};
        if (session !== feedSessionRef.current) return;
        if (Array.isArray(data.markets)) setGeneratedMarkets(data.markets);
      } catch {
        // ignore
      }
    }
    void boot();
    return undefined;
  }, [tab, filtersKey, marketCategory, activeSubcat, tz]);

  useEffect(() => {
    function onNewPeak(e: Event) {
      if (!showLatestPeaks) return;
      const ce = e as CustomEvent;
      const peak = ce.detail as Peak | undefined;
      if (!peak || typeof peak !== "object") return;
      setPeaks((prev) => [peak, ...prev].slice(0, 30));
    }
    window.addEventListener("peaksees:new-peak", onNewPeak as EventListener);
    return () =>
      window.removeEventListener("peaksees:new-peak", onNewPeak as EventListener);
  }, [showLatestPeaks]);

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
            {allowedSubcats.length > 0 ? (
              <div className="-mx-3 mt-2 feed-scroll flex items-center gap-3 overflow-x-auto px-3 pb-1">
                {allowedSubcats.map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-sparkle-click="true"
                    onClick={() => setSubcat(s)}
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                      activeSubcat === s
                        ? "border-zinc-300 bg-white text-zinc-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        : "border-transparent bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
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
        {tab === "live" ? <LiveStreamPanel /> : null}
        <PeakFeed
          key={`${tab}-${explore}`}
          posts={dedupePostsByMarketId(generatedAsPosts, posts)}
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
