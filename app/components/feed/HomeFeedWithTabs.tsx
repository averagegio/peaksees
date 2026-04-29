"use client";

import { useEffect, useRef, useState } from "react";

import { PeakFeed } from "@/app/components/PeakFeed";
import {
  MARKET_FEED_FOLLOWING,
  MARKET_FEED_FOR_YOU,
} from "@/app/lib/mock-markets";

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
      className={`min-h-8 flex-1 rounded-full px-2.5 py-1 text-[12px] font-medium outline-none ring-emerald-500/35 transition focus-visible:ring-2 sm:py-1.5 sm:text-[13px] ${
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
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [tabsVisible, setTabsVisible] = useState(true);
  const [bottomRefreshing, setBottomRefreshing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollTopPrev = useRef(0);
  const pulseLock = useRef(false);
  const lastPulseAt = useRef(0);

  const posts = tab === "foryou" ? MARKET_FEED_FOR_YOU : MARKET_FEED_FOLLOWING;

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

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
      <section
        className={`shrink-0 overflow-hidden border-b border-zinc-200/65 transition-[max-height,padding,opacity,margin] duration-[320ms] ease-out dark:border-zinc-800 ${
          tabsVisible ? "pointer-events-auto max-h-24 opacity-100" : "pointer-events-none max-h-0 border-transparent opacity-0"
        }`}
        aria-hidden={!tabsVisible}
      >
        <div className="px-3 py-2 sm:px-4">
          <div
            role="tablist"
            aria-label="For you or Following"
            className="mx-auto flex max-w-[17.5rem] gap-px rounded-full border border-zinc-200/75 bg-white/90 p-[2px] shadow-sm backdrop-blur-sm dark:border-zinc-700/85 dark:bg-zinc-900/80"
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
          </div>
        </div>
      </section>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        <PeakFeed key={tab} posts={posts} />
        <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
        {bottomRefreshing ? (
          <Spinner label="Refreshing feed…" />
        ) : null}
      </div>
    </div>
  );
}
