"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { marketCardHaptic } from "@/app/lib/haptics";
import type { MarketPost } from "@/app/lib/mock-markets";

const SCRUB_DRAG_PX = 5;
const SCRUB_HOLD_MS = 200;
/** Dots visible inside the mobile scrub pill (sliding window around active card). */
const MOBILE_VISIBLE_DOTS = 5;

type ScrubGesture = {
  armed: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  startScroll: number;
};

function detectTouchScrubUi() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 768px)").matches
  );
}

function useTouchScrubUi() {
  const [enabled, setEnabled] = useState(detectTouchScrubUi);

  useLayoutEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)");
    const narrow = window.matchMedia("(max-width: 768px)");
    const update = () => setEnabled(coarse.matches || narrow.matches);
    update();
    coarse.addEventListener("change", update);
    narrow.addEventListener("change", update);
    return () => {
      coarse.removeEventListener("change", update);
      narrow.removeEventListener("change", update);
    };
  }, []);

  return enabled;
}

function visibleDotIndices(count: number, active: number, maxVisible: number) {
  if (count <= maxVisible) {
    return Array.from({ length: count }, (_, i) => i);
  }
  const half = Math.floor(maxVisible / 2);
  const start = Math.max(0, Math.min(active - half, count - maxVisible));
  return Array.from({ length: maxVisible }, (_, i) => start + i);
}

function scrollIndex(viewport: HTMLElement, count: number) {
  const w = viewport.clientWidth;
  if (w <= 0 || count === 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(viewport.scrollLeft / w)));
}

function DotIndicators({
  posts,
  activeIndex,
  indices,
  compact,
  scrubbing,
}: {
  posts: MarketPost[];
  activeIndex: number;
  indices?: number[];
  compact?: boolean;
  scrubbing?: boolean;
}) {
  const list = indices ?? posts.map((_, i) => i);
  return (
    <>
      {list.map((i) => {
        const p = posts[i];
        if (!p) return null;
        const active = i === activeIndex;
        return (
          <span
            key={`dot-${p.id}`}
            data-marquee-dot=""
            className={
              "block rounded-full motion-safe:transition-all motion-safe:duration-200 " +
              (compact
                ? active
                  ? "h-1.5 w-3 bg-emerald-600 dark:bg-emerald-400 " +
                    (scrubbing ? "scale-105" : "")
                  : "h-1 w-1.5 bg-zinc-400/90 dark:bg-zinc-500"
                : active
                  ? "h-1 w-4 bg-emerald-600 dark:bg-emerald-400 " + (scrubbing ? "scale-105" : "")
                  : "h-1 w-1 bg-zinc-300/90 dark:bg-zinc-600")
            }
            aria-hidden
          />
        );
      })}
    </>
  );
}

/**
 * Compact dots in a transparent pill under the card.
 * Mobile: tap (haptic) → hold or drag → scrub (pull haptic + outline).
 */
export function FeedMarqueeDotScrub({
  posts,
  activeIndex,
  variant = "default",
  viewportRef,
  pullRefreshing = false,
  pauseForUser,
  goToSlide,
  syncIndexFromScroll,
  onScrubbingChange,
}: {
  posts: MarketPost[];
  activeIndex: number;
  variant?: "default" | "hero";
  viewportRef: RefObject<HTMLDivElement | null>;
  pullRefreshing?: boolean;
  pauseForUser: () => void;
  goToSlide: (index: number) => void;
  syncIndexFromScroll: () => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
}) {
  const isHero = variant === "hero";
  const isMobileUi = useTouchScrubUi();
  const [isScrubbing, setIsScrubbing] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);
  const listenersCleanupRef = useRef<(() => void) | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHapticIndexRef = useRef(-1);
  const scrubRef = useRef<ScrubGesture>({
    armed: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startScroll: 0,
  });

  const railClass =
    "feed-marquee-dots pointer-events-none absolute inset-x-0 z-20 flex items-center justify-center px-3 " +
    (isHero ? "bottom-0 pb-3 pt-8" : "bottom-0 pb-2 pt-6") +
    (isMobileUi ? " feed-marquee-dots--mobile" : "");

  const setScrubbing = useCallback(
    (scrubbing: boolean) => {
      setIsScrubbing(scrubbing);
      onScrubbingChange?.(scrubbing);
    },
    [onScrubbingChange],
  );

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const pulseScrubIndex = useCallback(
    (viewport: HTMLElement) => {
      const ix = scrollIndex(viewport, posts.length);
      if (ix !== lastHapticIndexRef.current) {
        lastHapticIndexRef.current = ix;
        marketCardHaptic("scrub");
      }
    },
    [posts.length],
  );

  const armScrub = useCallback(
    (pointerId: number, clientX?: number) => {
      const el = viewportRef.current;
      if (!el || scrubRef.current.armed) return;
      clearHoldTimer();
      if (clientX != null) {
        scrubRef.current.startX = clientX;
        scrubRef.current.startScroll = el.scrollLeft;
      }
      scrubRef.current.armed = true;
      lastHapticIndexRef.current = scrollIndex(el, posts.length);
      setScrubbing(true);
      try {
        el.setPointerCapture(pointerId);
      } catch {
        // ignore
      }
      marketCardHaptic("pull");
    },
    [clearHoldTimer, posts.length, setScrubbing, viewportRef],
  );

  const endScrub = useCallback(
    (pointerId: number) => {
      const el = viewportRef.current;
      if (!scrubRef.current.armed) return;
      scrubRef.current.armed = false;
      setScrubbing(false);
      lastHapticIndexRef.current = -1;
      pauseForUser();
      if (el) {
        try {
          el.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
        goToSlide(scrollIndex(el, posts.length));
      }
    },
    [goToSlide, pauseForUser, posts.length, setScrubbing, viewportRef],
  );

  const bindPillListeners = useCallback(() => {
    listenersCleanupRef.current?.();
    listenersCleanupRef.current = null;
    clearHoldTimer();

    if (!isMobileUi) {
      setScrubbing(false);
      return;
    }

    const el = viewportRef.current;
    const pill = pillRef.current;
    if (!el || !pill || posts.length < 2) return;

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshing || e.touches.length !== 1) return;
      marketCardHaptic("press");
    };

    const onPointerDown = (e: PointerEvent) => {
      if (pullRefreshing || e.pointerType === "mouse") return;

      pauseForUser();
      if (e.pointerType !== "touch") {
        marketCardHaptic("press");
      }

      scrubRef.current = {
        armed: false,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startScroll: el.scrollLeft,
      };
      lastHapticIndexRef.current = scrollIndex(el, posts.length);

      holdTimerRef.current = setTimeout(() => {
        if (
          scrubRef.current.pointerId === e.pointerId &&
          !scrubRef.current.armed
        ) {
          armScrub(e.pointerId);
        }
      }, SCRUB_HOLD_MS);

      try {
        pill.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== scrubRef.current.pointerId) return;

      const dx = e.clientX - scrubRef.current.startX;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(e.clientY - scrubRef.current.startY);

      if (!scrubRef.current.armed) {
        if (absDx >= SCRUB_DRAG_PX && absDx > absDy * 1.1) {
          armScrub(e.pointerId, e.clientX);
        } else if (absDy > 14) {
          clearHoldTimer();
        }
        return;
      }

      e.preventDefault();
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      el.scrollLeft = Math.max(
        0,
        Math.min(maxScroll, scrubRef.current.startScroll - dx),
      );
      pulseScrubIndex(el);
      syncIndexFromScroll();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== scrubRef.current.pointerId) return;
      clearHoldTimer();
      if (scrubRef.current.armed) {
        endScrub(e.pointerId);
      }
      try {
        pill.releasePointerCapture(e.pointerId);
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

    pill.addEventListener("touchstart", onTouchStart, { passive: true });
    pill.addEventListener("pointerdown", onPointerDown);
    pill.addEventListener("pointermove", onPointerMove, { passive: false });
    pill.addEventListener("pointerup", onPointerUp);
    pill.addEventListener("pointercancel", onPointerUp);

    listenersCleanupRef.current = () => {
      clearHoldTimer();
      pill.removeEventListener("touchstart", onTouchStart);
      pill.removeEventListener("pointerdown", onPointerDown);
      pill.removeEventListener("pointermove", onPointerMove);
      pill.removeEventListener("pointerup", onPointerUp);
      pill.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    armScrub,
    clearHoldTimer,
    endScrub,
    isMobileUi,
    pauseForUser,
    posts.length,
    pullRefreshing,
    pulseScrubIndex,
    setScrubbing,
    syncIndexFromScroll,
    viewportRef,
  ]);

  useLayoutEffect(() => {
    bindPillListeners();
    return () => listenersCleanupRef.current?.();
  }, [bindPillListeners]);

  useEffect(() => {
    if (!isMobileUi) {
      listenersCleanupRef.current?.();
      listenersCleanupRef.current = null;
    }
  }, [isMobileUi]);

  const mobileDotIndices = visibleDotIndices(
    posts.length,
    activeIndex,
    MOBILE_VISIBLE_DOTS,
  );

  const showOutline = isMobileUi && isScrubbing;

  const pillClass =
    "feed-marquee-scrub-pill flex items-center justify-center rounded-full " +
    (isMobileUi
      ? "pointer-events-auto gap-1.5 px-2.5 py-1.5 min-h-8 min-w-[3.25rem] " +
        (showOutline ? "feed-marquee-scrub-pill--outline" : "")
      : "pointer-events-none gap-1.5 px-3 py-1.5 ");

  if (posts.length < 2) return null;

  return (
    <div className={railClass} aria-hidden={!isMobileUi}>
      <div
        ref={(node) => {
          pillRef.current = node;
        }}
        data-marquee-dot-scrub={isMobileUi ? "" : undefined}
        data-no-marquee-gesture={isMobileUi ? "true" : undefined}
        role={isMobileUi ? "slider" : undefined}
        aria-label={
          isMobileUi
            ? `Market carousel, ${activeIndex + 1} of ${posts.length}`
            : undefined
        }
        aria-valuemin={isMobileUi ? 1 : undefined}
        aria-valuemax={isMobileUi ? posts.length : undefined}
        aria-valuenow={isMobileUi ? activeIndex + 1 : undefined}
        className={pillClass}
      >
        <DotIndicators
          posts={posts}
          activeIndex={activeIndex}
          indices={isMobileUi ? mobileDotIndices : undefined}
          compact={isMobileUi}
          scrubbing={isMobileUi ? isScrubbing : false}
        />
      </div>
    </div>
  );
}
