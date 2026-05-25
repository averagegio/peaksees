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

const SCRUB_ARM_PX = 8;
/** Viewport fraction dragged to advance one card. */
const SCRUB_VIEWPORT_PER_CARD = 0.42;
const MOBILE_VISIBLE_DOTS = 5;

type ScrubGesture = {
  armed: boolean;
  active: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  startIndex: number;
  startScrollLeft: number;
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

function slideWidthPx(viewport: HTMLElement) {
  return Math.max(1, Math.floor(viewport.clientWidth));
}

function indexFromScroll(viewport: HTMLElement, count: number) {
  const w = slideWidthPx(viewport);
  return Math.max(0, Math.min(count - 1, Math.round(viewport.scrollLeft / w)));
}

function maxScrollLeft(viewport: HTMLElement, count: number) {
  const w = slideWidthPx(viewport);
  return Math.max(0, (count - 1) * w);
}

function setViewportScrubMode(viewport: HTMLElement | null, on: boolean) {
  if (!viewport) return;
  if (on) {
    viewport.classList.add("feed-marquee--scrubbing");
  } else {
    viewport.classList.remove("feed-marquee--scrubbing");
  }
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
 * Mobile: tap pill, drag sideways to scrub. Uses touch + pointer and syncs scroll immediately.
 */
export function FeedMarqueeDotScrub({
  posts,
  activeIndex,
  variant = "default",
  viewportRef,
  pullRefreshing = false,
  pauseForUser,
  goToSlide,
  onScrubIndex,
  onScrubbingChange,
}: {
  posts: MarketPost[];
  activeIndex: number;
  variant?: "default" | "hero";
  viewportRef: RefObject<HTMLDivElement | null>;
  pullRefreshing?: boolean;
  pauseForUser: () => void;
  goToSlide: (index: number) => void;
  onScrubIndex?: (index: number) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
}) {
  const isHero = variant === "hero";
  const isMobileUi = useTouchScrubUi();
  const [pillEngaged, setPillEngaged] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);
  const listenersCleanupRef = useRef<(() => void) | null>(null);
  const lastHapticIndexRef = useRef(-1);
  const scrubRef = useRef<ScrubGesture>({
    armed: false,
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startIndex: 0,
    startScrollLeft: 0,
  });

  const railClass =
    "feed-marquee-dots pointer-events-none absolute inset-x-0 z-20 flex items-center justify-center px-3 " +
    (isHero ? "bottom-0 pb-3 pt-8" : "bottom-0 pb-2 pt-6") +
    (isMobileUi ? " feed-marquee-dots--mobile" : "");

  const setMarqueeScrubbing = useCallback(
    (scrubbing: boolean) => {
      setPillEngaged(scrubbing);
      onScrubbingChange?.(scrubbing);
      setViewportScrubMode(viewportRef.current, scrubbing);
    },
    [onScrubbingChange, viewportRef],
  );

  const resetGesture = useCallback(() => {
    scrubRef.current = {
      armed: false,
      active: false,
      pointerId: -1,
      startX: 0,
      startY: 0,
      startIndex: 0,
      startScrollLeft: 0,
    };
    lastHapticIndexRef.current = -1;
    setMarqueeScrubbing(false);
  }, [setMarqueeScrubbing]);

  const pulseScrubIndex = useCallback((ix: number) => {
    if (ix !== lastHapticIndexRef.current) {
      lastHapticIndexRef.current = ix;
      marketCardHaptic("scrub");
    }
  }, []);

  const applyScrubFromDrag = useCallback(
    (viewport: HTMLElement, clientX: number) => {
      const slideW = slideWidthPx(viewport);
      const dx = clientX - scrubRef.current.startX;
      const maxLeft = maxScrollLeft(viewport, posts.length);
      const left = Math.max(
        0,
        Math.min(maxLeft, scrubRef.current.startScrollLeft - dx),
      );
      viewport.scrollLeft = left;
      const ix = indexFromScroll(viewport, posts.length);
      onScrubIndex?.(ix);
      pulseScrubIndex(ix);
      return ix;
    },
    [onScrubIndex, posts.length, pulseScrubIndex],
  );

  const beginGesture = useCallback(
    (viewport: HTMLElement, clientX: number, clientY: number, pointerId: number) => {
      if (pullRefreshing || scrubRef.current.active) return;

      pauseForUser();
      const startIx = indexFromScroll(viewport, posts.length);
      const slideW = slideWidthPx(viewport);
      scrubRef.current = {
        armed: false,
        active: true,
        pointerId,
        startX: clientX,
        startY: clientY,
        startIndex: startIx,
        startScrollLeft: startIx * slideW,
      };
      lastHapticIndexRef.current = startIx;
      setMarqueeScrubbing(true);
      marketCardHaptic("press");
    },
    [pauseForUser, posts.length, pullRefreshing, setMarqueeScrubbing],
  );

  const armScrub = useCallback(() => {
    if (scrubRef.current.armed) return;
    scrubRef.current.armed = true;
    marketCardHaptic("pull");
  }, []);

  const tryArmFromDelta = useCallback(
    (clientX: number, clientY: number) => {
      if (scrubRef.current.armed || !scrubRef.current.active) return false;
      const dx = clientX - scrubRef.current.startX;
      const dy = clientY - scrubRef.current.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx >= SCRUB_ARM_PX && absDx >= absDy * 1.02) {
        armScrub();
        return true;
      }
      return false;
    },
    [armScrub],
  );

  const endScrub = useCallback(() => {
    if (!scrubRef.current.active) return;
    const el = viewportRef.current;
    const wasArmed = scrubRef.current.armed;
    scrubRef.current.active = false;
    scrubRef.current.armed = false;
    scrubRef.current.pointerId = -1;
    lastHapticIndexRef.current = -1;
    setMarqueeScrubbing(false);

    if (el) {
      pauseForUser();
      const ix = indexFromScroll(el, posts.length);
      if (wasArmed) {
        goToSlide(ix);
      }
      onScrubIndex?.(ix);
    }
  }, [goToSlide, onScrubIndex, pauseForUser, posts.length, setMarqueeScrubbing, viewportRef]);

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

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshing || e.touches.length !== 1) return;
      e.stopPropagation();
      const t = e.touches[0]!;
      beginGesture(viewport, t.clientX, t.clientY, t.identifier);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!scrubRef.current.active || e.touches.length !== 1) return;
      const t = e.touches[0]!;
      if (tryArmFromDelta(t.clientX, t.clientY)) {
        e.preventDefault();
      }
      if (!scrubRef.current.armed) return;
      e.preventDefault();
      applyScrubFromDrag(viewport, t.clientX);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!scrubRef.current.active) return;
      if (e.touches.length > 0) return;
      endScrub();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (pullRefreshing || e.pointerType === "mouse") return;
      e.stopPropagation();
      beginGesture(viewport, e.clientX, e.clientY, e.pointerId);
      try {
        pill.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!scrubRef.current.active || e.pointerId !== scrubRef.current.pointerId) {
        return;
      }
      if (tryArmFromDelta(e.clientX, e.clientY)) {
        e.preventDefault();
      }
      if (!scrubRef.current.armed) return;
      e.preventDefault();
      applyScrubFromDrag(viewport, e.clientX);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!scrubRef.current.active || e.pointerId !== scrubRef.current.pointerId) return;
      endScrub();
    };

    pill.addEventListener("touchstart", onTouchStart, { passive: false });
    pill.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    document.addEventListener("touchend", onTouchEnd, { capture: true });
    document.addEventListener("touchcancel", onTouchEnd, { capture: true });
    document.addEventListener("pointermove", onPointerMove, { passive: false, capture: true });
    document.addEventListener("pointerup", onPointerUp, { capture: true });
    document.addEventListener("pointercancel", onPointerUp, { capture: true });

    listenersCleanupRef.current = () => {
      pill.removeEventListener("touchstart", onTouchStart);
      pill.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("touchmove", onTouchMove, { capture: true });
      document.removeEventListener("touchend", onTouchEnd, { capture: true });
      document.removeEventListener("touchcancel", onTouchEnd, { capture: true });
      document.removeEventListener("pointermove", onPointerMove, { capture: true });
      document.removeEventListener("pointerup", onPointerUp, { capture: true });
      document.removeEventListener("pointercancel", onPointerUp, { capture: true });
    };
  }, [
    applyScrubFromDrag,
    beginGesture,
    endScrub,
    isMobileUi,
    posts.length,
    pullRefreshing,
    resetGesture,
    tryArmFromDelta,
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
    return () => {
      listenersCleanupRef.current?.();
      resetGesture();
    };
  }, [bindPillListeners, resetGesture]);

  useEffect(() => {
    if (!isMobileUi) {
      listenersCleanupRef.current?.();
      resetGesture();
    }
  }, [isMobileUi, resetGesture]);

  const mobileDotIndices = visibleDotIndices(
    posts.length,
    activeIndex,
    MOBILE_VISIBLE_DOTS,
  );

  const showOutline = isMobileUi && pillEngaged;

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
        ref={isMobileUi ? setPillRef : undefined}
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
          scrubbing={isMobileUi && pillEngaged}
        />
      </div>
    </div>
  );
}
