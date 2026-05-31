"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { MarketPostCard } from "@/app/components/PeakFeed";
import { FeedMarqueeDotScrub } from "@/app/components/feed/FeedMarqueeDotScrub";
import { PullRefreshRail, pullDisplacement } from "@/app/components/feed/pull-refresh-rail";
import type { MarketPost } from "@/app/lib/mock-markets";

const MARQUEE_PAUSE_MS = 4_200;
const MARQUEE_TRANSITION_MS = 520;
const USER_IDLE_MS = 9_000;
const PULL_THRESHOLD_PX = 48;

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
      'button, a, input, textarea, select, label, [role="button"], [data-marquee-dot-scrub], [data-no-marquee-gesture="true"], [data-no-insight-gesture="true"]',
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
  posts = [],
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
  posts?: MarketPost[];
  viewerUserId?: string;
  tourMarketPostIndex?: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  highlightMarketId?: string;
  onActiveIndexChange?: (index: number) => void;
  variant?: "default" | "hero";
  onPullRefresh?: () => void | Promise<void>;
  pullRefreshing?: boolean;
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
  const isScrubbingRef = useRef(false);
  const pausedUntilRef = useRef(0);
  const scrollingProgrammaticallyRef = useRef(false);
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportScrollLeftRef = useRef(0);
  const pullRootRef = useRef<HTMLDivElement | null>(null);
  const pullOffsetRef = useRef(0);
  const touchPullRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    mode: PullMode | null;
  }>({ active: false, startX: 0, startY: 0, mode: null });

  const measure = useCallback(() => {
    const el = viewportRef?.current;
    if (!el) return;
    const w = Math.floor(el.clientWidth);
    if (w > 0) setSlideWidth(w);
  }, [viewportRef]);

  const syncIndexFromScroll = useCallback(() => {
    const el = viewportRef?.current;
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

  const goToSlide = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const el = viewportRef?.current;
      if (!el || posts.length === 0) return;
      const ix = Math.max(0, Math.min(posts.length - 1, index));
      pauseForUser();
      scrollingProgrammaticallyRef.current = true;
      scrollToSlide(el, ix, behavior);
      activeIndexRef.current = ix;
      setActiveIndex(ix);
      window.setTimeout(() => {
        scrollingProgrammaticallyRef.current = false;
      }, behavior === "smooth" ? MARQUEE_TRANSITION_MS + 80 : 0);
    },
    [pauseForUser, posts.length, viewportRef],
  );

  const handleScrubIndex = useCallback((index: number) => {
    const ix = Math.max(0, Math.min(posts.length - 1, index));
    if (ix !== activeIndexRef.current) {
      activeIndexRef.current = ix;
      setActiveIndex(ix);
    }
  }, [posts.length]);

  const clearScrubScrollStyles = useCallback(() => {
    const el = viewportRef?.current;
    if (!el) return;
    el.classList.remove("feed-marquee--scrubbing");
    el.style.removeProperty("scroll-snap-type");
  }, [viewportRef]);

  const scrubScrollTo = useCallback((left: number) => {
    const el = viewportRef?.current;
    if (!el) return;
    el.classList.add("feed-marquee--scrubbing");
    el.style.scrollSnapType = "none";
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    el.scrollLeft = Math.max(0, Math.min(max, left));
  }, [viewportRef]);

  const scrubToIndexDuringPill = useCallback(
    (index: number) => {
      const el = viewportRef?.current;
      if (!el) return;
      el.classList.add("feed-marquee--scrubbing");
      el.style.scrollSnapType = "none";
      goToSlide(index, "instant");
    },
    [goToSlide, viewportRef],
  );

  const resetPull = useCallback(() => {
    touchPullRef.current.active = false;
    touchPullRef.current.mode = null;
    pullOffsetRef.current = 0;
    setPullOffset(0);
    setPullMode(null);
  }, []);

  const setPullOffsetPx = useCallback((v: number) => {
    pullOffsetRef.current = v;
    setPullOffset(v);
  }, []);

  useLayoutEffect(() => {
    const el = viewportRef?.current;
    if (!el) return undefined;
    const run = () => measure();
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    const raf1 = requestAnimationFrame(run);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [measure, viewportRef, posts.length]);

  useEffect(() => {
    isScrubbingRef.current = isScrubbing;
  }, [isScrubbing]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    onActiveIndexChange?.(activeIndex);
  }, [activeIndex, onActiveIndexChange]);

  const handleScrubbingChange = useCallback((scrubbing: boolean) => {
    isScrubbingRef.current = scrubbing;
    setIsScrubbing(scrubbing);
    if (scrubbing) {
      pausedUntilRef.current = Date.now() + USER_IDLE_MS;
      scrollingProgrammaticallyRef.current = true;
    } else {
      scrollingProgrammaticallyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!highlightMarketId?.trim() || posts.length === 0) return undefined;
    const ix = posts.findIndex((p) => p.id === highlightMarketId.trim());
    if (ix < 0) return undefined;
    const el = viewportRef?.current;
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
      const el = viewportRef?.current;
      if (el) scrollToSlide(el, 0, "instant");
    }
  }, [posts.length, activeIndex, viewportRef]);

  useEffect(() => {
    const el = viewportRef?.current;
    if (!el || posts.length < 2) return undefined;

    viewportScrollLeftRef.current = el.scrollLeft;

    const onScroll = () => {
      viewportScrollLeftRef.current = el.scrollLeft;

      if (!scrollingProgrammaticallyRef.current && !isScrubbing) {
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
  }, [posts.length, viewportRef, syncIndexFromScroll, isScrubbing]);

  useEffect(() => {
    const el = viewportRef?.current;
    if (!el || posts.length < 2 || prefersReducedMotion()) {
      return undefined;
    }

    const tick = () => {
      if (Date.now() < pausedUntilRef.current || isScrubbingRef.current) return;
      const w = el.clientWidth;
      if (w <= 0) return;
      const next = (activeIndexRef.current + 1) % posts.length;
      scrollingProgrammaticallyRef.current = true;
      scrollToSlide(el, next, "smooth");
      activeIndexRef.current = next;
      setActiveIndex(next);
      window.setTimeout(() => {
        if (!isScrubbingRef.current) {
          scrollingProgrammaticallyRef.current = false;
        }
      }, MARQUEE_TRANSITION_MS + 80);
    };

    const id = window.setInterval(tick, MARQUEE_PAUSE_MS);
    return () => window.clearInterval(id);
  }, [posts.length, viewportRef, slideWidth]);

  useEffect(() => {
    const root = pullRootRef.current;
    const viewport = viewportRef?.current;
    if (!root || !viewport || !pullEnabled) return undefined;

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshing || e.touches.length !== 1) return;
      if (isMarqueeGestureBlocker(e.target)) return;

      const t = e.touches[0]!;
      pauseForUser();
      touchPullRef.current = {
        active: true,
        startX: t.clientX,
        startY: t.clientY,
        mode: null,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = touchPullRef.current;
      if (!g.active || pullRefreshing || e.touches.length !== 1) return;

      const t = e.touches[0]!;
      const dx = t.clientX - g.startX;
      const dy = t.clientY - g.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (!g.mode) {
        if (absX < 6 && absY < 6) return;

        if (absX > absY * 1.15) {
          if (dx < 0 || viewport.scrollLeft > 2) {
            g.active = false;
            return;
          }
          if (dx > 0 && viewport.scrollLeft <= 2) {
            g.mode = "horizontal";
            setPullMode("horizontal");
            e.preventDefault();
            setPullOffsetPx(pullDisplacement(dx));
            return;
          }
          g.active = false;
          return;
        }

        if (isCoarsePointer() && pageScrollAtTop && dy > 0 && absY > absX * 1.15) {
          g.mode = "vertical";
          setPullMode("vertical");
          e.preventDefault();
          setPullOffsetPx(pullDisplacement(dy));
          return;
        }

        g.active = false;
        return;
      }

      if (g.mode === "horizontal") {
        if (dx <= 0) {
          resetPull();
          return;
        }
        e.preventDefault();
        setPullOffsetPx(pullDisplacement(dx));
      } else if (g.mode === "vertical") {
        if (dy <= 0) {
          resetPull();
          return;
        }
        e.preventDefault();
        setPullOffsetPx(pullDisplacement(dy));
      }
    };

    const onTouchEnd = () => {
      const g = touchPullRef.current;
      if (!g.active) return;

      const mode = g.mode;
      const offset = pullOffsetRef.current;
      resetPull();

      if (offset >= PULL_THRESHOLD_PX && mode && onPullRefresh) {
        void onPullRefresh();
      }
    };

    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    root.addEventListener("touchend", onTouchEnd);
    root.addEventListener("touchcancel", onTouchEnd);

    return () => {
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("touchend", onTouchEnd);
      root.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [
    pullEnabled,
    pullRefreshing,
    pageScrollAtTop,
    onPullRefresh,
    pauseForUser,
    resetPull,
    setPullOffsetPx,
    viewportRef,
  ]);

  useEffect(() => {
    const root = pullRootRef.current;
    if (!root || !pullEnabled) return undefined;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch" || pullRefreshing) return;
      if (e.button !== 0 || isMarqueeGestureBlocker(e.target)) return;
      pauseForUser();
      touchPullRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        mode: null,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const g = touchPullRef.current;
      const viewport = viewportRef?.current;
      if (!g.active || !viewport || pullRefreshing || e.pointerType === "touch") return;

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;

      if (!g.mode) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < 6 && absY < 6) return;
        if (viewport.scrollLeft <= 2 && dx > 0 && absX > absY * 1.15) {
          g.mode = "horizontal";
          setPullMode("horizontal");
        } else if (pageScrollAtTop && dy > 0 && absY > absX * 1.15) {
          g.mode = "vertical";
          setPullMode("vertical");
        } else {
          g.active = false;
          return;
        }
      }

      if (g.mode === "horizontal" && dx > 0) {
        e.preventDefault();
        setPullOffsetPx(pullDisplacement(dx));
      } else if (g.mode === "vertical" && dy > 0) {
        e.preventDefault();
        setPullOffsetPx(pullDisplacement(dy));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const g = touchPullRef.current;
      if (!g.active) return;
      const mode = g.mode;
      const offset = pullOffsetRef.current;
      resetPull();
      if (offset >= PULL_THRESHOLD_PX && mode && onPullRefresh) {
        void onPullRefresh();
      }
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove, { passive: false });
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerUp);

    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    pullEnabled,
    pullRefreshing,
    pageScrollAtTop,
    onPullRefresh,
    pauseForUser,
    resetPull,
    setPullOffsetPx,
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
    <div
      ref={pullRootRef}
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
    >
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
            "feed-marquee-viewport feed-scroll feed-scroll-x relative min-h-0 w-full flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain overscroll-y-none snap-x snap-mandatory " +
            (isScrubbing ? "feed-marquee--scrubbing cursor-grabbing snap-none " : "") +
            (pullOffset > 0 ? "feed-marquee--pulling" : "")
          }
          onWheel={pauseForUser}
        >
          {isScrubbing && posts.length > 1 ? (
            <div
              className="pointer-events-none absolute right-3 top-3 z-20 rounded-md bg-black/55 px-2 py-0.5 text-xs font-semibold tabular-nums text-white/95 md:hidden"
              aria-hidden
            >
              {activeIndex + 1} / {posts.length}
            </div>
          ) : null}
          <div
            className={
              "feed-marquee-track motion-safe:transition-transform motion-safe:duration-75 motion-safe:ease-out " +
              (isScrubbing ? "motion-safe:transition-none" : "")
            }
            style={trackTransform ? { transform: trackTransform } : undefined}
          >
            {posts.map((post, i) => (
              <div
                key={post.id}
                data-market-slide={post.id}
                className="feed-marquee-slide h-full shrink-0 snap-start snap-always"
                style={
                  slideWidth > 0
                    ? {
                        width: slideWidth,
                        minWidth: slideWidth,
                        maxWidth: slideWidth,
                        flexBasis: slideWidth,
                      }
                    : undefined
                }
              >
                <div
                  className={
                    isHero
                      ? "h-full min-h-0 px-1.5 py-1 sm:px-2 sm:py-1.5"
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
        <FeedMarqueeDotScrub
          posts={posts}
          activeIndex={activeIndex}
          variant={variant}
          viewportRef={viewportRef}
          pullRefreshing={pullRefreshing}
          pauseForUser={pauseForUser}
          goToSlide={(ix) => goToSlide(ix, "smooth")}
          scrubToIndex={scrubToIndexDuringPill}
          scrubScrollTo={scrubScrollTo}
          clearScrubScrollStyles={clearScrubScrollStyles}
          onScrubIndex={handleScrubIndex}
          onScrubbingChange={handleScrubbingChange}
          viewportReady={slideWidth > 0}
        />
      ) : null}
    </div>
  );
}
