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
/** Min horizontal movement before pill scrub locks (ignores vertical page scroll). */
const SCRUB_LOCK_PX = 10;
/** Horizontal must dominate vertical by this ratio to lock scrub. */
const SCRUB_HORIZONTAL_RATIO = 1.2;

type ScrubGesture = {
  pending: boolean;
  armed: boolean;
  active: boolean;
  horizontalLocked: boolean;
  cancelled: boolean;
  input: "touch" | "pointer" | "";
  touchId: number;
  pointerId: number;
  startX: number;
  startY: number;
  startIndex: number;
  startScrollLeft: number;
  pullHapticFired: boolean;
};

function isHorizontalScrubIntent(dx: number, dy: number) {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  return absX >= SCRUB_LOCK_PX && absX >= absY * SCRUB_HORIZONTAL_RATIO;
}

function isVerticalScrollIntent(dx: number, dy: number) {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  return absY >= SCRUB_LOCK_PX && absY > absX * SCRUB_HORIZONTAL_RATIO;
}

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
 * Mobile: touch the pill and drag — carousel follows finger (touch-first for iOS).
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
  scrubScrollTo,
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
  scrubScrollTo: (scrollLeft: number) => void;
  clearScrubScrollStyles: () => void;
  onScrubIndex?: (index: number) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
  /** True while the user swipes the carousel viewport (not auto-advance). */
  carouselInteracting?: boolean;
}) {
  const isHero = variant === "hero";
  const isMobileUi = useTouchScrubUi();
  const [pillEngaged, setPillEngaged] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);
  const listenersCleanupRef = useRef<(() => void) | null>(null);
  const lastHapticIndexRef = useRef(-1);
  const lastScrubIndexRef = useRef(-1);
  const scrubRef = useRef<ScrubGesture>({
    pending: false,
    armed: false,
    active: false,
    horizontalLocked: false,
    cancelled: false,
    input: "",
    touchId: -1,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startIndex: 0,
    startScrollLeft: 0,
    pullHapticFired: false,
  });

  const railClass =
    "feed-marquee-dots pointer-events-none absolute inset-x-0 z-30 flex items-center justify-center px-3 " +
    (isHero ? "bottom-0 pb-3 pt-8" : "bottom-0 pb-2 pt-6") +
    (isMobileUi ? " feed-marquee-dots--mobile" : "");

  const setMarqueeScrubbing = useCallback(
    (scrubbing: boolean) => {
      setPillEngaged(scrubbing);
      onScrubbingChange?.(scrubbing);
    },
    [onScrubbingChange],
  );

  const resetGesture = useCallback(() => {
    scrubRef.current = {
      pending: false,
      armed: false,
      active: false,
      horizontalLocked: false,
      cancelled: false,
      input: "",
      touchId: -1,
      pointerId: -1,
      startX: 0,
      startY: 0,
      startIndex: 0,
      startScrollLeft: 0,
      pullHapticFired: false,
    };
    lastHapticIndexRef.current = -1;
    lastScrubIndexRef.current = -1;
    setMarqueeScrubbing(false);
    clearScrubScrollStyles();
  }, [clearScrubScrollStyles, setMarqueeScrubbing]);

  const pulseScrubIndex = useCallback((ix: number) => {
    if (ix !== lastHapticIndexRef.current) {
      lastHapticIndexRef.current = ix;
      marketCardHaptic("scrub");
    }
  }, []);

  const applyScrubFromDrag = useCallback(
    (viewport: HTMLElement, clientX: number) => {
      const dx = clientX - scrubRef.current.startX;
      if (!scrubRef.current.pullHapticFired && Math.abs(dx) > 3) {
        scrubRef.current.pullHapticFired = true;
        marketCardHaptic("pull");
      }

      const slideW = slideWidthPx(viewport);
      const left = scrubRef.current.startScrollLeft - dx;
      scrubScrollTo(left);

      const ix = Math.max(
        0,
        Math.min(posts.length - 1, Math.round(scrubRef.current.startIndex - dx / slideW)),
      );

      if (ix !== lastScrubIndexRef.current) {
        lastScrubIndexRef.current = ix;
        scrubToIndex(ix);
      }

      onScrubIndex?.(ix);
      pulseScrubIndex(ix);
      return ix;
    },
    [onScrubIndex, posts.length, pulseScrubIndex, scrubScrollTo, scrubToIndex],
  );

  const lockHorizontalScrub = useCallback(
    (viewport: HTMLElement, clientX: number, clientY: number) => {
      const startIx = indexFromScroll(viewport, posts.length);
      const slideW = slideWidthPx(viewport);
      const startLeft = viewport.scrollLeft || startIx * slideW;

      scrubRef.current.horizontalLocked = true;
      scrubRef.current.armed = true;
      scrubRef.current.pending = false;
      scrubRef.current.startX = clientX;
      scrubRef.current.startY = clientY;
      scrubRef.current.startIndex = startIx;
      scrubRef.current.startScrollLeft = startLeft;
      scrubRef.current.pullHapticFired = false;
      lastHapticIndexRef.current = startIx;
      lastScrubIndexRef.current = startIx;
      setMarqueeScrubbing(true);
      scrubScrollTo(startLeft);
      marketCardHaptic("press");
    },
    [scrubScrollTo, setMarqueeScrubbing],
  );

  const beginGesture = useCallback(
    (
      viewport: HTMLElement,
      clientX: number,
      clientY: number,
      input: "touch" | "pointer",
      touchId: number,
      pointerId: number,
    ) => {
      if (pullRefreshing || scrubRef.current.active || scrubRef.current.pending) return;

      pauseForUser();

      scrubRef.current = {
        pending: true,
        armed: false,
        active: true,
        horizontalLocked: false,
        cancelled: false,
        input,
        touchId,
        pointerId,
        startX: clientX,
        startY: clientY,
        startIndex: indexFromScroll(viewport, posts.length),
        startScrollLeft: viewport.scrollLeft,
        pullHapticFired: false,
      };
    },
    [pauseForUser, posts.length, pullRefreshing],
  );

  const resolveGestureAxis = useCallback(
    (viewport: HTMLElement, clientX: number, clientY: number): "scroll" | "scrub" | "pending" => {
      const g = scrubRef.current;
      if (!g.active || g.cancelled || g.horizontalLocked) {
        return g.horizontalLocked ? "scrub" : "scroll";
      }

      const dx = clientX - g.startX;
      const dy = clientY - g.startY;

      if (isVerticalScrollIntent(dx, dy)) {
        g.cancelled = true;
        g.pending = false;
        g.active = false;
        setMarqueeScrubbing(false);
        clearScrubScrollStyles();
        return "scroll";
      }

      if (isHorizontalScrubIntent(dx, dy)) {
        lockHorizontalScrub(viewport, clientX, clientY);
        return "scrub";
      }

      return "pending";
    },
    [clearScrubScrollStyles, lockHorizontalScrub, setMarqueeScrubbing],
  );

  const endScrub = useCallback(() => {
    if (!scrubRef.current.active && !scrubRef.current.pending) return;
    const el = viewportRef.current;
    const wasScrubbing = scrubRef.current.horizontalLocked && scrubRef.current.armed;
    scrubRef.current.pending = false;
    scrubRef.current.active = false;
    scrubRef.current.armed = false;
    scrubRef.current.horizontalLocked = false;
    scrubRef.current.cancelled = false;
    scrubRef.current.input = "";
    scrubRef.current.touchId = -1;
    scrubRef.current.pointerId = -1;
    lastHapticIndexRef.current = -1;
    lastScrubIndexRef.current = -1;
    setMarqueeScrubbing(false);
    clearScrubScrollStyles();

    if (el && wasScrubbing) {
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
    setMarqueeScrubbing,
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

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshing || e.touches.length !== 1) return;
      e.stopPropagation();
      const t = e.touches[0]!;
      beginGesture(viewport, t.clientX, t.clientY, "touch", t.identifier, -1);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (scrubRef.current.input !== "touch" || !scrubRef.current.active) return;
      const t = Array.from(e.touches).find((x) => x.identifier === scrubRef.current.touchId);
      if (!t) return;

      const axis = resolveGestureAxis(viewport, t.clientX, t.clientY);
      if (axis === "scroll" || axis === "pending") return;

      e.preventDefault();
      applyScrubFromDrag(viewport, t.clientX);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (scrubRef.current.input !== "touch") return;
      if (!scrubRef.current.active && !scrubRef.current.pending) return;
      const ended = Array.from(e.changedTouches).some(
        (t) => t.identifier === scrubRef.current.touchId,
      );
      if (!ended) return;
      endScrub();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (pullRefreshing || e.pointerType === "mouse") return;
      if (scrubRef.current.input === "touch") return;
      e.stopPropagation();
      beginGesture(viewport, e.clientX, e.clientY, "pointer", -1, e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (scrubRef.current.input !== "pointer" || !scrubRef.current.active) return;
      if (e.pointerId !== scrubRef.current.pointerId) return;

      const axis = resolveGestureAxis(viewport, e.clientX, e.clientY);
      if (axis === "scroll" || axis === "pending") return;

      e.preventDefault();
      applyScrubFromDrag(viewport, e.clientX);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (scrubRef.current.input !== "pointer") return;
      if (e.pointerId !== scrubRef.current.pointerId) return;
      if (!scrubRef.current.active && !scrubRef.current.pending) return;
      endScrub();
    };

    pill.addEventListener("touchstart", onTouchStart, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
    document.addEventListener("touchend", onTouchEnd, { capture: true });
    document.addEventListener("touchcancel", onTouchEnd, { capture: true });
    pill.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove, { passive: false, capture: true });
    document.addEventListener("pointerup", onPointerUp, { capture: true });
    document.addEventListener("pointercancel", onPointerUp, { capture: true });

    listenersCleanupRef.current = () => {
      pill.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove, { capture: true });
      document.removeEventListener("touchend", onTouchEnd, { capture: true });
      document.removeEventListener("touchcancel", onTouchEnd, { capture: true });
      pill.removeEventListener("pointerdown", onPointerDown);
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
    resolveGestureAxis,
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
    const retry = requestAnimationFrame(() => bindPillListeners());
    return () => {
      cancelAnimationFrame(retry);
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

  const showOutline = isMobileUi && (pillEngaged || carouselInteracting);

  const pillClass =
    "feed-marquee-scrub-pill relative z-10 flex items-center justify-center rounded-full " +
    (isMobileUi
      ? "pointer-events-auto gap-1.5 px-3 py-2 min-h-9 min-w-[3.5rem] " +
        (showOutline ? "feed-marquee-scrub-pill--engaged " : "")
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
          scrubbing={showOutline}
        />
      </div>
    </div>
  );
}
