"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { MarketPostCard } from "@/app/components/PeakFeed";
import { PullRefreshRail, pullDisplacement } from "@/app/components/feed/pull-refresh-rail";
import { marketCardHaptic } from "@/app/lib/haptics";
import type { MarketPost } from "@/app/lib/mock-markets";

const MARQUEE_PAUSE_MS = 4_200;
const MARQUEE_TRANSITION_MS = 520;
const USER_IDLE_MS = 9_000;
const PULL_THRESHOLD_PX = 48;
const SCRUB_HOLD_MS = 300;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

function isMarqueeGestureBlocker(t: EventTarget | null) {
  if (!(t instanceof Element)) return false;
  return Boolean(
    t.closest(
      'button, a, input, textarea, select, label, [role="button"], [data-no-marquee-gesture="true"], [data-no-insight-gesture="true"]',
    ),
  );
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

type PullMode = "horizontal" | "vertical";

export function FeedMarketMarquee({
  posts,
  viewerUserId,
  tourMarketPostIndex = 0,
  viewportRef,
  sentinelRef,
  highlightMarketId,
  onActiveIndexChange,
  variant = "default",
  onPullRefresh,
  pullRefreshing = false,
  pageScrollAtTop = true,
}: {
  posts: MarketPost[];
  viewerUserId?: string;
  tourMarketPostIndex?: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  highlightMarketId?: string;
  onActiveIndexChange?: (index: number) => void;
  variant?: "default" | "hero";
  onPullRefresh?: () => void | Promise<void>;
  pullRefreshing?: boolean;
  /** When true, pull-down refresh is allowed on mobile at carousel start. */
  pageScrollAtTop?: boolean;
}) {
  const isHero = variant === "hero";
  const pullEnabled = Boolean(onPullRefresh);
  const [slideWidth, setSlideWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pullOffset, setPullOffset] = useState(0);
  const [pullMode, setPullMode] = useState<PullMode | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const activeIndexRef = useRef(0);
  const pausedUntilRef = useRef(0);
  const scrollingProgrammaticallyRef = useRef(false);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pullGestureRef = useRef<{
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    mode: PullMode | null;
  }>({ active: false, pointerId: -1, startX: 0, startY: 0, mode: null });
  const scrubTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubRef = useRef({
    armed: false,
    pointerId: -1,
    startX: 0,
    startScroll: 0,
  });
  const pullOffsetRef = useRef(0);

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const w = Math.floor(el.clientWidth);
    if (w > 0) setSlideWidth(w);
  }, [viewportRef]);

  const syncIndexFromScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el || posts.length === 0) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    const ix = Math.max(0, Math.min(posts.length - 1, Math.round(el.scrollLeft / w)));
    if (ix !== activeIndexRef.current) {
      activeIndexRef.current = ix;
      setActiveIndex(ix);
    }
  }, [posts.length, viewportRef]);

  const pauseForUser = useCallback(() => {
    pausedUntilRef.current = Date.now() + USER_IDLE_MS;
  }, []);

  const clearScrubTimer = useCallback(() => {
    if (scrubTimerRef.current) {
      clearTimeout(scrubTimerRef.current);
      scrubTimerRef.current = null;
    }
  }, []);

  const endScrub = useCallback(
    (pointerId: number) => {
      const el = viewportRef.current;
      if (!scrubRef.current.armed) return;
      scrubRef.current.armed = false;
      setIsScrubbing(false);
      pauseForUser();
      if (el) {
        try {
          el.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
        const w = el.clientWidth;
        if (w > 0) {
          const ix = Math.max(0, Math.min(posts.length - 1, Math.round(el.scrollLeft / w)));
          scrollingProgrammaticallyRef.current = true;
          scrollToSlide(el, ix, "smooth");
          activeIndexRef.current = ix;
          setActiveIndex(ix);
          window.setTimeout(() => {
            scrollingProgrammaticallyRef.current = false;
          }, MARQUEE_TRANSITION_MS + 80);
        }
      }
    },
    [pauseForUser, posts.length, viewportRef],
  );

  const resetPull = useCallback(() => {
    pullGestureRef.current.active = false;
    pullGestureRef.current.mode = null;
    pullOffsetRef.current = 0;
    setPullOffset(0);
    setPullMode(null);
  }, []);

  const setPullOffsetPx = useCallback((v: number) => {
    pullOffsetRef.current = v;
    setPullOffset(v);
  }, []);

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

    const onScroll = () => {
      if (!scrollingProgrammaticallyRef.current && !scrubRef.current.armed) {
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
  }, [posts.length, viewportRef, syncIndexFromScroll]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || posts.length < 2 || prefersReducedMotion() || isScrubbing) return undefined;

    const tick = () => {
      if (Date.now() < pausedUntilRef.current || scrubRef.current.armed) return;
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
  }, [posts.length, viewportRef, slideWidth, isScrubbing]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const onPointerDown = (e: PointerEvent) => {
      if (pullRefreshing || isMarqueeGestureBlocker(e.target)) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      pauseForUser();
      clearScrubTimer();
      scrubRef.current = {
        armed: false,
        pointerId: e.pointerId,
        startX: e.clientX,
        startScroll: el.scrollLeft,
      };

      scrubTimerRef.current = setTimeout(() => {
        if (pullGestureRef.current.active && pullGestureRef.current.mode) return;
        scrubRef.current.armed = true;
        setIsScrubbing(true);
        pausedUntilRef.current = Date.now() + 86_400_000;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        marketCardHaptic("press");
      }, SCRUB_HOLD_MS);

      pullGestureRef.current = {
        active: true,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        mode: null,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const g = pullGestureRef.current;

      if (scrubRef.current.armed && e.pointerId === scrubRef.current.pointerId) {
        e.preventDefault();
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        const dx = e.clientX - scrubRef.current.startX;
        el.scrollLeft = Math.max(0, Math.min(maxScroll, scrubRef.current.startScroll - dx));
        syncIndexFromScroll();
        return;
      }

      if (scrubTimerRef.current && e.pointerId === scrubRef.current.pointerId) {
        const jx = Math.abs(e.clientX - scrubRef.current.startX);
        const jy = Math.abs(e.clientY - g.startY);
        if (jx > 10 || jy > 10) clearScrubTimer();
      }

      if (!g.active || e.pointerId !== g.pointerId || pullRefreshing) return;

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;

      if (!g.mode) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < 8 && absY < 8) return;

        if (
          pullEnabled &&
          el.scrollLeft <= 2 &&
          dx > 0 &&
          absX > absY * 1.15
        ) {
          g.mode = "horizontal";
          clearScrubTimer();
          setPullMode("horizontal");
        } else if (
          pullEnabled &&
          isCoarsePointer() &&
          pageScrollAtTop &&
          dy > 0 &&
          absY > absX * 1.15
        ) {
          g.mode = "vertical";
          clearScrubTimer();
          setPullMode("vertical");
        } else if (absX > 10 || absY > 10) {
          clearScrubTimer();
          g.active = false;
          return;
        } else {
          return;
        }
      }

      if (g.mode === "horizontal" && dx > 0 && el.scrollLeft <= 2) {
        e.preventDefault();
        const v = pullDisplacement(dx);
        setPullOffsetPx(v);
      } else if (g.mode === "vertical" && dy > 0) {
        e.preventDefault();
        const v = pullDisplacement(dy);
        setPullOffsetPx(v);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      clearScrubTimer();

      if (scrubRef.current.armed && e.pointerId === scrubRef.current.pointerId) {
        endScrub(e.pointerId);
      }

      const g = pullGestureRef.current;
      if (!g.active || e.pointerId !== g.pointerId) return;

      const mode = g.mode;
      const offset = pullOffsetRef.current;
      resetPull();

      if (pullEnabled && offset >= PULL_THRESHOLD_PX && mode && onPullRefresh) {
        void onPullRefresh();
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);

    return () => {
      clearScrubTimer();
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    pullEnabled,
    pullRefreshing,
    pageScrollAtTop,
    onPullRefresh,
    pauseForUser,
    clearScrubTimer,
    endScrub,
    resetPull,
    setPullOffsetPx,
    syncIndexFromScroll,
    viewportRef,
  ]);

  useEffect(() => {
    if (!pullRefreshing) return;
    resetPull();
  }, [pullRefreshing, resetPull]);

  const trackTransform =
    pullMode === "horizontal"
      ? `translateX(${pullOffset}px)`
      : pullMode === "vertical"
        ? `translateY(${pullOffset}px)`
        : undefined;

  if (posts.length === 0) {
    return (
      <div
        className={
          "flex h-full w-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-400 " +
          (isHero ? "px-8" : "px-3")
        }
      >
        Markets are generating — pull to refresh or check back in a moment.
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      {pullMode === "vertical" && (pullOffset > 0 || pullRefreshing) ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center">
          <PullRefreshRail
            orientation="vertical"
            expandedPx={pullRefreshing ? 78 : pullOffset}
            loading={pullRefreshing}
          />
        </div>
      ) : null}

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-row items-stretch">
        {pullMode === "horizontal" && (pullOffset > 0 || pullRefreshing) ? (
          <PullRefreshRail
            orientation="horizontal"
            expandedPx={pullRefreshing ? 78 : pullOffset}
            loading={pullRefreshing}
          />
        ) : null}

        <div
          ref={viewportRef}
          className={
            "feed-marquee-viewport feed-scroll feed-scroll-x relative min-h-0 w-full flex-1 touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-none scroll-smooth snap-x snap-mandatory " +
            (isScrubbing ? "feed-marquee--scrubbing cursor-grabbing snap-none" : "") +
            (pullOffset > 0 ? " feed-marquee--pulling" : "")
          }
          onWheel={pauseForUser}
        >
          <div
            className={
              "flex h-full min-h-0 flex-row items-stretch motion-safe:transition-transform motion-safe:duration-75 motion-safe:ease-out " +
              (isScrubbing ? "motion-safe:transition-none" : "")
            }
            style={trackTransform ? { transform: trackTransform } : undefined}
          >
            {posts.map((post, i) => (
              <div
                key={post.id}
                data-market-slide={post.id}
                className="feed-marquee-slide box-border h-full shrink-0 snap-start snap-always"
                style={slideWidth > 0 ? { width: slideWidth } : undefined}
              >
                <div
                  className={
                    isHero
                      ? "h-full min-h-0 px-4 py-4 sm:px-8 sm:py-5"
                      : "h-full min-h-0 px-1 sm:px-1.5"
                  }
                >
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
      </div>

      {posts.length > 1 ? (
        <div
          className={
            "pointer-events-none absolute left-0 right-14 flex justify-center gap-1.5 " +
            (isHero ? "bottom-5" : "bottom-2")
          }
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

      {isScrubbing ? (
        <p className="pointer-events-none absolute left-0 right-0 top-2 z-20 text-center text-[10px] font-semibold uppercase tracking-wide text-emerald-700/90 dark:text-emerald-400/90">
          Scrub carousel
        </p>
      ) : null}
    </div>
  );
}
