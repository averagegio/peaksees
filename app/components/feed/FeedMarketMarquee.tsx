"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { MarketPostCard } from "@/app/components/PeakFeed";
import type { MarketPost } from "@/app/lib/mock-markets";

const MARQUEE_PAUSE_MS = 4_200;
const MARQUEE_TRANSITION_MS = 520;
const USER_IDLE_MS = 9_000;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToSlide(
  viewport: HTMLElement,
  index: number,
  behavior: ScrollBehavior = "smooth",
) {
  const w = viewport.clientWidth;
  if (w <= 0) return;
  viewport.scrollTo({ left: index * w, behavior });
}

export function FeedMarketMarquee({
  posts,
  viewerUserId,
  tourMarketPostIndex = 0,
  viewportRef,
  sentinelRef,
  highlightMarketId,
  onActiveIndexChange,
}: {
  posts: MarketPost[];
  viewerUserId?: string;
  tourMarketPostIndex?: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  highlightMarketId?: string;
  onActiveIndexChange?: (index: number) => void;
}) {
  const [slideWidth, setSlideWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const pausedUntilRef = useRef(0);
  const scrollingProgrammaticallyRef = useRef(false);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const w = Math.floor(el.clientWidth);
    if (w > 0) setSlideWidth(w);
  }, [viewportRef]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, viewportRef]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    onActiveIndexChange?.(activeIndex);
  }, [activeIndex, onActiveIndexChange]);

  useEffect(() => {
    if (!highlightMarketId?.trim() || posts.length === 0) return undefined;
    const ix = posts.findIndex((p) => p.id === highlightMarketId.trim());
    if (ix < 0) return undefined;
    const el = viewportRef.current;
    if (!el) return undefined;
    const t = window.setTimeout(() => {
      scrollingProgrammaticallyRef.current = true;
      scrollToSlide(el, ix, "smooth");
      setActiveIndex(ix);
      activeIndexRef.current = ix;
      pausedUntilRef.current = Date.now() + USER_IDLE_MS;
      window.setTimeout(() => {
        scrollingProgrammaticallyRef.current = false;
      }, MARQUEE_TRANSITION_MS + 80);
    }, 160);
    return () => window.clearTimeout(t);
  }, [highlightMarketId, posts, viewportRef]);

  useEffect(() => {
    if (activeIndex >= posts.length && posts.length > 0) {
      setActiveIndex(0);
      activeIndexRef.current = 0;
      const el = viewportRef.current;
      if (el) scrollToSlide(el, 0, "instant");
    }
  }, [posts.length, activeIndex, viewportRef]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || posts.length < 2) return undefined;

    const syncIndexFromScroll = () => {
      const w = el.clientWidth;
      if (w <= 0) return;
      const ix = Math.max(0, Math.min(posts.length - 1, Math.round(el.scrollLeft / w)));
      if (ix !== activeIndexRef.current) {
        activeIndexRef.current = ix;
        setActiveIndex(ix);
      }
    };

    const onScroll = () => {
      if (!scrollingProgrammaticallyRef.current) {
        pausedUntilRef.current = Date.now() + USER_IDLE_MS;
      }
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = setTimeout(syncIndexFromScroll, 48);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
    };
  }, [posts.length, viewportRef]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || posts.length < 2 || prefersReducedMotion()) return undefined;

    const tick = () => {
      if (Date.now() < pausedUntilRef.current) return;
      const w = el.clientWidth;
      if (w <= 0) return;
      const next = (activeIndexRef.current + 1) % posts.length;
      scrollingProgrammaticallyRef.current = true;
      scrollToSlide(el, next, "smooth");
      activeIndexRef.current = next;
      setActiveIndex(next);
      window.setTimeout(() => {
        scrollingProgrammaticallyRef.current = false;
      }, MARQUEE_TRANSITION_MS + 80);
    };

    const id = window.setInterval(tick, MARQUEE_PAUSE_MS);
    return () => window.clearInterval(id);
  }, [posts.length, viewportRef, slideWidth]);

  const pauseForUser = () => {
    pausedUntilRef.current = Date.now() + USER_IDLE_MS;
  };

  if (posts.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center px-3 text-sm text-zinc-500 dark:text-zinc-400">
        Markets are generating — pull to refresh or check back in a moment.
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col">
      <div
        ref={viewportRef}
        data-tour="feed-scroll"
        className="feed-marquee-viewport feed-scroll feed-scroll-x min-h-0 w-full flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth snap-x snap-mandatory"
        onPointerDown={pauseForUser}
        onTouchStart={pauseForUser}
        onWheel={pauseForUser}
      >
        <div className="flex h-full min-h-0 flex-row items-stretch">
          {posts.map((post, i) => (
            <div
              key={post.id}
              data-market-slide={post.id}
              className="feed-marquee-slide box-border h-full shrink-0 snap-start snap-always"
              style={slideWidth > 0 ? { width: slideWidth } : undefined}
            >
              <div className="h-full min-h-0 px-1 sm:px-1.5">
                <MarketPostCard
                  post={post}
                  isTourAnchor={i === tourMarketPostIndex}
                  viewerUserId={viewerUserId}
                  fillHeight
                  marqueeMode
                />
              </div>
            </div>
          ))}
          <div
            ref={sentinelRef}
            className="h-full shrink-0 snap-start"
            style={{ width: slideWidth > 0 ? Math.max(8, slideWidth * 0.04) : 8 }}
            aria-hidden
          />
        </div>
      </div>

      {posts.length > 1 ? (
        <div
          className="pointer-events-none absolute bottom-2 left-0 right-14 flex justify-center gap-1.5"
          aria-hidden
        >
          {posts.map((p, i) => (
            <span
              key={`dot-${p.id}`}
              className={
                "h-1 rounded-full motion-safe:transition-all motion-safe:duration-300 " +
                (i === activeIndex
                  ? "w-4 bg-emerald-600 dark:bg-emerald-400"
                  : "w-1 bg-zinc-300/90 dark:bg-zinc-600")
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
