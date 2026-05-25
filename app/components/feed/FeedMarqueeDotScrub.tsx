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

const MOBILE_VISIBLE_DOTS = 5;
/** Viewport widths dragged to advance one card (higher = slower, clearer snap). */
const SCRUB_DRAG_PER_CARD = 0.72;

type ScrubGesture = {
  active: boolean;
  touchId: number;
  pointerId: number;
  startX: number;
  startIndex: number;
  pullHapticFired: boolean;
};

function detectTouchScrubUi() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 768px)").matches
  );
}

function useTouchScrubUi() {
  const [enabled, setEnabled] = useState(false);

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

function slideWidthPx(viewport: HTMLElement) {
  return Math.max(1, Math.floor(viewport.clientWidth));
}

function indexFromScroll(viewport: HTMLElement, count: number) {
  const w = slideWidthPx(viewport);
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
 * Mobile: tap the pill and drag horizontally — carousel snaps card-by-card.
 */
export function FeedMarqueeDotScrub({
  posts,
  activeIndex,
  variant = "default",
  viewportRef,
  pullRefreshing = false,
  pauseForUser,
  goToSlide,
  scrubToIndex,
  clearScrubScrollStyles,
  onScrubIndex,
  onScrubbingChange,
  carouselInteracting = false,
}: {
  posts: MarketPost[];
  activeIndex: number;
  variant?: "default" | "hero";
  viewportRef: RefObject<HTMLDivElement | null>;
  pullRefreshing?: boolean;
  pauseForUser: () => void;
  goToSlide: (index: number) => void;
  scrubToIndex: (index: number) => void;
  clearScrubScrollStyles: () => void;
  onScrubIndex?: (index: number) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
  carouselInteracting?: boolean;
}) {
  const isHero = variant === "hero";
  const isMobileUi = useTouchScrubUi();
  const [pillOutline, setPillOutline] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);
  const listenersCleanupRef = useRef<(() => void) | null>(null);
  const lastHapticIndexRef = useRef(-1);
  const lastScrubIndexRef = useRef(-1);
  const scrubRef = useRef<ScrubGesture>({
    active: false,
    touchId: -1,
    pointerId: -1,
    startX: 0,
    startIndex: 0,
    pullHapticFired: false,
  });

  const railClass =
    "feed-marquee-dots pointer-events-none absolute inset-x-0 z-40 flex items-center justify-center px-3 " +
    (isHero ? "bottom-0 pb-3 pt-8" : "bottom-0 pb-2 pt-6") +
    (isMobileUi ? " feed-marquee-dots--mobile" : "");

  const setCarouselPaused = useCallback(
    (paused: boolean) => {
      onScrubbingChange?.(paused);
    },
    [onScrubbingChange],
  );

  const resetGesture = useCallback(() => {
    scrubRef.current = {
      active: false,
      touchId: -1,
      pointerId: -1,
      startX: 0,
      startIndex: 0,
      pullHapticFired: false,
    };
    lastHapticIndexRef.current = -1;
    lastScrubIndexRef.current = -1;
    setPillOutline(false);
    setCarouselPaused(false);
    clearScrubScrollStyles();
  }, [clearScrubScrollStyles, setCarouselPaused]);

  const pulseScrubIndex = useCallback((ix: number) => {
    if (ix !== lastHapticIndexRef.current) {
      lastHapticIndexRef.current = ix;
      marketCardHaptic("scrub");
    }
  }, []);

  const applyScrubFromDrag = useCallback(
    (viewport: HTMLElement, clientX: number) => {
      const dx = clientX - scrubRef.current.startX;
      if (!scrubRef.current.pullHapticFired && Math.abs(dx) > 4) {
        scrubRef.current.pullHapticFired = true;
        marketCardHaptic("pull");
      }

      const slideW = slideWidthPx(viewport);
      const pxPerCard = Math.max(slideW * SCRUB_DRAG_PER_CARD, 56);
      const ix = Math.max(
        0,
        Math.min(
          posts.length - 1,
          Math.round(scrubRef.current.startIndex - dx / pxPerCard),
        ),
      );

      if (ix !== lastScrubIndexRef.current) {
        lastScrubIndexRef.current = ix;
        pauseForUser();
        scrubToIndex(ix);
        onScrubIndex?.(ix);
        pulseScrubIndex(ix);
      }

      return ix;
    },
    [onScrubIndex, pauseForUser, posts.length, pulseScrubIndex, scrubToIndex],
  );

  const startScrub = useCallback(
    (viewport: HTMLElement, clientX: number, touchId: number, pointerId: number) => {
      if (pullRefreshing || scrubRef.current.active) return;

      pauseForUser();
      setCarouselPaused(true);

      const startIx = indexFromScroll(viewport, posts.length);
      scrubRef.current = {
        active: true,
        touchId,
        pointerId,
        startX: clientX,
        startIndex: startIx,
        pullHapticFired: false,
      };
      lastHapticIndexRef.current = startIx;
      lastScrubIndexRef.current = startIx;
      setPillOutline(true);
      scrubToIndex(startIx);
      marketCardHaptic("press");
    },
    [pauseForUser, posts.length, pullRefreshing, scrubToIndex, setCarouselPaused],
  );

  const endScrub = useCallback(() => {
    if (!scrubRef.current.active) return;
    const el = viewportRef.current;
    scrubRef.current.active = false;
    scrubRef.current.touchId = -1;
    scrubRef.current.pointerId = -1;
    lastHapticIndexRef.current = -1;
    lastScrubIndexRef.current = -1;
    setPillOutline(false);
    setCarouselPaused(false);
    clearScrubScrollStyles();

    if (el) {
      pauseForUser();
      const ix = indexFromScroll(el, posts.length);
      goToSlide(ix);
      onScrubIndex?.(ix);
    }
  }, [
    clearScrubScrollStyles,
    goToSlide,
    onScrubIndex,
    pauseForUser,
    posts.length,
    setCarouselPaused,
    viewportRef,
  ]);

  const bindPillListeners = useCallback(() => {
    listenersCleanupRef.current?.();
    listenersCleanupRef.current = null;

    if (!isMobileUi) {
      resetGesture();
      return;
    }

    const viewport = viewportRef.current;
    const pill = pillRef.current;
    if (!viewport || !pill || posts.length < 2) return;

    const useCoarseTouch =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshing || e.touches.length !== 1) return;
      e.stopPropagation();
      const t = e.touches[0]!;
      startScrub(viewport, t.clientX, t.identifier, -1);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!scrubRef.current.active || e.touches.length < 1) return;
      const t =
        Array.from(e.touches).find((x) => x.identifier === scrubRef.current.touchId) ??
        e.touches[0];
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      applyScrubFromDrag(viewport, t.clientX);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!scrubRef.current.active) return;
      const ended = Array.from(e.changedTouches).some(
        (t) => t.identifier === scrubRef.current.touchId,
      );
      if (!ended && e.touches.length > 0) return;
      endScrub();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (pullRefreshing || e.pointerType === "mouse") return;
      if (useCoarseTouch) return;
      e.stopPropagation();
      e.preventDefault();
      startScrub(viewport, e.clientX, -1, e.pointerId);
      try {
        pill.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!scrubRef.current.active || scrubRef.current.pointerId !== e.pointerId) return;
      e.preventDefault();
      applyScrubFromDrag(viewport, e.clientX);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!scrubRef.current.active || scrubRef.current.pointerId !== e.pointerId) return;
      endScrub();
      try {
        pill.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    pill.addEventListener("touchstart", onTouchStart, { passive: false });
    pill.addEventListener("touchmove", onTouchMove, { passive: false });
    pill.addEventListener("touchend", onTouchEnd, { passive: true });
    pill.addEventListener("touchcancel", onTouchEnd, { passive: true });

    if (!useCoarseTouch) {
      pill.addEventListener("pointerdown", onPointerDown);
      pill.addEventListener("pointermove", onPointerMove);
      pill.addEventListener("pointerup", onPointerUp);
      pill.addEventListener("pointercancel", onPointerUp);
    }

    listenersCleanupRef.current = () => {
      pill.removeEventListener("touchstart", onTouchStart);
      pill.removeEventListener("touchmove", onTouchMove);
      pill.removeEventListener("touchend", onTouchEnd);
      pill.removeEventListener("touchcancel", onTouchEnd);
      pill.removeEventListener("pointerdown", onPointerDown);
      pill.removeEventListener("pointermove", onPointerMove);
      pill.removeEventListener("pointerup", onPointerUp);
      pill.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    applyScrubFromDrag,
    endScrub,
    isMobileUi,
    posts.length,
    pullRefreshing,
    resetGesture,
    startScrub,
    viewportRef,
  ]);

  const setPillRef = useCallback(
    (node: HTMLDivElement | null) => {
      pillRef.current = node;
      if (node) bindPillListeners();
    },
    [bindPillListeners],
  );

  useLayoutEffect(() => {
    bindPillListeners();
    const t1 = requestAnimationFrame(() => bindPillListeners());
    const t2 = window.setTimeout(() => bindPillListeners(), 120);
    return () => {
      cancelAnimationFrame(t1);
      window.clearTimeout(t2);
      listenersCleanupRef.current?.();
      resetGesture();
    };
  }, [bindPillListeners, resetGesture, posts.length]);

  useEffect(() => {
    if (!isMobileUi) {
      listenersCleanupRef.current?.();
      resetGesture();
      return;
    }
    bindPillListeners();
  }, [bindPillListeners, isMobileUi, resetGesture]);

  const mobileDotIndices = visibleDotIndices(
    posts.length,
    activeIndex,
    MOBILE_VISIBLE_DOTS,
  );

  const showOutline = isMobileUi && (pillOutline || carouselInteracting);

  const pillClass =
    "feed-marquee-scrub-pill relative z-10 flex items-center justify-center rounded-full " +
    (isMobileUi
      ? "pointer-events-auto touch-manipulation gap-1.5 px-4 py-2.5 min-h-10 min-w-[4rem] " +
        (showOutline ? "feed-marquee-scrub-pill--engaged " : "")
      : "pointer-events-none gap-1.5 px-3 py-1.5 ");

  if (posts.length < 2) return null;

  return (
    <div className={railClass}>
      <div
        ref={setPillRef}
        data-marquee-dot-scrub=""
        data-no-marquee-gesture="true"
        role="slider"
        aria-label={`Market carousel scrub, ${activeIndex + 1} of ${posts.length}`}
        aria-valuemin={1}
        aria-valuemax={posts.length}
        aria-valuenow={activeIndex + 1}
        className={pillClass}
      >
        <DotIndicators
          posts={posts}
          activeIndex={activeIndex}
          indices={isMobileUi ? mobileDotIndices : undefined}
          compact={isMobileUi}
          scrubbing={showOutline}
        />
      </div>
    </div>
  );
}
