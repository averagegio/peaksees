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
import { PullRefreshRail, pullDisplacement } from "@/app/components/feed/pull-refresh-rail";
import { marketCardHaptic } from "@/app/lib/haptics";
import type { MarketPost } from "@/app/lib/mock-markets";

const MARQUEE_PAUSE_MS = 4_200;
const MARQUEE_TRANSITION_MS = 520;
const USER_IDLE_MS = 9_000;
const PULL_THRESHOLD_PX = 48;
const DOT_SCRUB_HOLD_MS = 220;
const DOT_SCRUB_DRAG_PX = 10;

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
    startY: 0,
    startScroll: 0,
  });
  const pullOffsetRef = useRef(0);
  const dotRailRef = useRef<HTMLDivElement | null>(null);
  const suppressDotClickRef = useRef(false);

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

  const armScrub = useCallback(
    (pointerId: number, clientX?: number) => {
      const el = viewportRef.current;
      if (!el || scrubRef.current.armed) return;
      if (clientX != null) {
        scrubRef.current.startX = clientX;
        scrubRef.current.startScroll = el.scrollLeft;
      }
      scrubRef.current.armed = true;
      setIsScrubbing(true);
      pausedUntilRef.current = Date.now() + 86_400_000;
      try {
        el.setPointerCapture(pointerId);
      } catch {
        // ignore
      }
      marketCardHaptic("press");
    },
    [],
  );

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

  const goToSlide = useCallback(
    (index: number) => {
      const el = viewportRef.current;
      if (!el || posts.length === 0) return;
      const ix = Math.max(0, Math.min(posts.length - 1, index));
      pauseForUser();
      scrollingProgrammaticallyRef.current = true;
      scrollToSlide(el, ix, "smooth");
      activeIndexRef.current = ix;
      setActiveIndex(ix);
      window.setTimeout(() => {
        scrollingProgrammaticallyRef.current = false;
      }, MARQUEE_TRANSITION_MS + 80);
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

  useLayoutEffect(() => {
    const el = viewportRef.current;
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
      if ((e.target as Element).closest("[data-marquee-dots]")) return;

      pauseForUser();
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
          setPullMode("horizontal");
        } else if (
          pullEnabled &&
          isCoarsePointer() &&
          pageScrollAtTop &&
          dy > 0 &&
          absY > absX * 1.15
        ) {
          g.mode = "vertical";
          setPullMode("vertical");
        } else if (absX > 10 || absY > 10) {
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
    resetPull,
    setPullOffsetPx,
    viewportRef,
  ]);

  useEffect(() => {
    const el = viewportRef.current;
    const rail = dotRailRef.current;
    if (!el || !rail || posts.length < 2) return undefined;

    const onRailPointerDown = (e: PointerEvent) => {
      if (pullRefreshing) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      pauseForUser();
      clearScrubTimer();
      scrubRef.current = {
        armed: false,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startScroll: el.scrollLeft,
      };

      scrubTimerRef.current = setTimeout(() => {
        armScrub(e.pointerId);
      }, DOT_SCRUB_HOLD_MS);

      try {
        rail.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onRailPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== scrubRef.current.pointerId) return;

      const dx = e.clientX - scrubRef.current.startX;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(e.clientY - scrubRef.current.startY);

      if (!scrubRef.current.armed && scrubTimerRef.current) {
        if (absDx >= DOT_SCRUB_DRAG_PX && absDx > absDy) {
          clearScrubTimer();
          armScrub(e.pointerId, e.clientX);
        } else if (absDy > 14) {
          clearScrubTimer();
        }
      }

      if (scrubRef.current.armed) {
        e.preventDefault();
        const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
        el.scrollLeft = Math.max(
          0,
          Math.min(maxScroll, scrubRef.current.startScroll - dx),
        );
        syncIndexFromScroll();
      }
    };

    const onRailPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== scrubRef.current.pointerId) return;
      clearScrubTimer();
      const wasScrub = scrubRef.current.armed;
      if (wasScrub) {
        suppressDotClickRef.current = true;
        endScrub(e.pointerId);
      }
      try {
        rail.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      scrubRef.current = {
        armed: false,
        pointerId: -1,
        startX: 0,
        startY: 0,
        startScroll: 0,
      };
    };

    rail.addEventListener("pointerdown", onRailPointerDown);
    rail.addEventListener("pointermove", onRailPointerMove, { passive: false });
    rail.addEventListener("pointerup", onRailPointerUp);
    rail.addEventListener("pointercancel", onRailPointerUp);

    return () => {
      clearScrubTimer();
      rail.removeEventListener("pointerdown", onRailPointerDown);
      rail.removeEventListener("pointermove", onRailPointerMove);
      rail.removeEventListener("pointerup", onRailPointerUp);
      rail.removeEventListener("pointercancel", onRailPointerUp);
    };
  }, [
    posts.length,
    pullRefreshing,
    pauseForUser,
    clearScrubTimer,
    armScrub,
    endScrub,
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
                    ? { width: slideWidth, minWidth: slideWidth, maxWidth: slideWidth, flexBasis: slideWidth }
                    : undefined
                }
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
          ref={dotRailRef}
          data-marquee-dots=""
          role="tablist"
          aria-label="Market card positions — tap to jump, hold and drag to scrub"
          className={
            "feed-marquee-dots absolute inset-x-0 z-10 flex items-center justify-center gap-1 px-3 " +
            (isHero ? "bottom-0 pb-3 pt-8" : "bottom-0 pb-2 pt-6") +
            (isScrubbing ? " feed-marquee-dots--scrubbing" : "")
          }
        >
          {posts.map((p, i) => (
            <button
              key={`dot-${p.id}`}
              type="button"
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`Market ${i + 1} of ${posts.length}`}
              data-marquee-dot=""
              onClick={() => {
                if (suppressDotClickRef.current) {
                  suppressDotClickRef.current = false;
                  return;
                }
                goToSlide(i);
              }}
              className="flex h-9 min-w-9 items-center justify-center rounded-full outline-none transition hover:bg-zinc-200/60 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-zinc-800/80"
            >
              <span
                className={
                  "block h-1.5 rounded-full motion-safe:transition-all motion-safe:duration-300 " +
                  (i === activeIndex
                    ? "w-5 bg-emerald-600 dark:bg-emerald-400"
                    : "w-1.5 bg-zinc-400/90 dark:bg-zinc-500")
                }
                aria-hidden
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
