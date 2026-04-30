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
      className={`poppy-hover sparkle-hover min-h-8 flex-1 rounded-full px-2.5 py-1 text-[12px] font-medium outline-none ring-emerald-500/35 transition focus-visible:ring-2 sm:py-1.5 sm:text-[13px] ${
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

function Spinner({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-8 text-[13px] text-zinc-600 dark:text-zinc-400"
    >
      <div
        className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-emerald-200 border-t-emerald-600 dark:border-zinc-600 dark:border-t-emerald-400"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

/** Feed tabs hide on scroll down; sentinel at bottom triggers a refresh pulse. */
export function HomeFeedWithTabs() {
  const [tab, setTab] = useState<"foryou" | "following" | "live">("foryou");
  const [explore, setExplore] = useState("Trending");
  const [tabsVisible, setTabsVisible] = useState(true);
  const [bottomRefreshing, setBottomRefreshing] = useState(false);
  const [peaks, setPeaks] = useState<Peak[]>([]);
  const [generatedMarkets, setGeneratedMarkets] = useState<Market[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollTopPrev = useRef(0);
  const pulseLock = useRef(false);
  const lastPulseAt = useRef(0);
  const sparkleLayerRef = useRef<HTMLDivElement>(null);

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
      volumeUsd: Math.round((m.volumeCents ?? 0) / 100),
      endsAtLabel: m.endsAt,
      outcomes: [
        { id: "y", label: "Yes", probability: yesP },
        { id: "n", label: "No", probability: noP },
      ],
    };
  });

  useEffect(() => {
    let cancelled = false;
    async function loadPeaks() {
      try {
        const res = await fetch("/api/peaks?limit=20", { cache: "no-store" });
        const data = (await safeJson<{ peaks?: Peak[] }>(res)) ?? {};
        if (!cancelled && Array.isArray(data.peaks)) setPeaks(data.peaks);
      } catch {
        // ignore
      }
    }
    loadPeaks();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMarkets() {
      try {
        const res = await fetch("/api/markets?limit=60&autogen=1&count=5", {
          cache: "no-store",
        });
        const data = (await safeJson<{ markets?: Market[] }>(res)) ?? {};
        if (!cancelled && Array.isArray(data.markets)) setGeneratedMarkets(data.markets);
      } catch {
        // ignore
      }
    }
    void loadMarkets();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onNewPeak(e: Event) {
      const ce = e as CustomEvent;
      const peak = ce.detail as Peak | undefined;
      if (!peak || typeof peak !== "object") return;
      setPeaks((prev) => [peak, ...prev].slice(0, 30));
    }
    window.addEventListener("peaksees:new-peak", onNewPeak as EventListener);
    return () =>
      window.removeEventListener("peaksees:new-peak", onNewPeak as EventListener);
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
    const root = scrollRef.current;
    const sent = sentinelRef.current;
    if (!root || !sent) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const slack = root.scrollHeight - root.clientHeight;
          if (slack < 56) return;
          const now = Date.now();
          if (pulseLock.current || now - lastPulseAt.current < 2000) return;
          lastPulseAt.current = now;
          pulseLock.current = true;

          setBottomRefreshing(true);
          // On refresh pulse, fetch markets with autogen enabled.
          // Rate-limited server-side to avoid excessive generation.
          void (async () => {
            try {
              const res = await fetch("/api/markets?limit=60&autogen=1&count=5", {
                cache: "no-store",
              });
              const data = (await safeJson<{ markets?: Market[] }>(res)) ?? {};
              if (Array.isArray(data.markets)) setGeneratedMarkets(data.markets);
            } catch {
              // ignore
            }
          })();
          window.setTimeout(() => {
            pulseLock.current = false;
            setBottomRefreshing(false);
          }, 900);
        });
      },
      { root, rootMargin: "0px 0px 80px 0px", threshold: 0 },
    );

    io.observe(sent);
    return () => io.disconnect();
  }, [tab]);

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
            <div className="-mx-3 feed-scroll flex items-center gap-4 overflow-x-auto px-3 pb-1">
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
                  className={`group sparkle-hover nav-chip-motion shrink-0 rounded-none px-0 py-1 text-[13px] font-semibold tracking-tight transition ${
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
                className="group sparkle-hover nav-chip-motion shrink-0 px-0 py-1 text-[13px] font-semibold tracking-tight text-fuchsia-700/65 transition hover:text-fuchsia-800 dark:text-fuchsia-300/70 dark:hover:text-fuchsia-200"
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
          </div>
        </div>
      </section>

      <div
        ref={scrollRef}
        className="feed-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        {tab === "live" ? <LiveStreamPanel /> : null}
        <PeakFeed
          key={`${tab}-${explore}`}
          posts={[...generatedAsPosts, ...posts]}
          contextLabel={explore}
          peaks={peaks}
        />
        <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
        {bottomRefreshing ? (
          <Spinner label="Refreshing feed…" />
        ) : null}
      </div>
    </div>
  );
}
