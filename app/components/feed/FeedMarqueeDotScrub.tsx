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
/** Inner horizontal padding inside pill for Instagram-style X mapping. */
const PILL_INNER_PAD_PX = 14;

type ScrubGesture = {
  active: boolean;
  touchId: number;
  pointerId: number;
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

function scrubFractionFromPillX(pill: HTMLElement, clientX: number) {
  const rect = pill.getBoundingClientRect();
  const usable = Math.max(1, rect.width - PILL_INNER_PAD_PX * 2);
  const localX = clientX - rect.left - PILL_INNER_PAD_PX;
  return Math.max(0, Math.min(1, localX / usable));
}

function indexFromFraction(fraction: number, count: number) {
  if (count <= 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(fraction * (count - 1))));
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
              "block rounded-full motion-safe:transition-all motion-safe:duration-150 " +
              (compact
                ? active
                  ? `h-2 w-2 bg-emerald-500 shadow-[0_0_6px_rgb(16_185_129/0.55)] ${
                      scrubbing ? "scale-110" : "scale-100"
                    }`
                  : "h-1.5 w-1.5 bg-zinc-400/55 dark:bg-zinc-500/70"
                : active
                  ? `h-1 w-4 bg-emerald-600 dark:bg-emerald-400 ${scrubbing ? "scale-105" : ""}`
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
 * Mobile Instagram-style scrub: pill hidden until tap, drag on pill maps X → carousel.
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
}) {
  const isHero = variant === "hero";
  const isMobileUi = useTouchScrubUi();
  const [pillVisible, setPillVisible] = useState(false);

  const hitRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const listenersCleanupRef = useRef<(() => void) | null>(null);
  const lastHapticIndexRef = useRef(-1);
  const scrubRef = useRef<ScrubGesture>({
    active: false,
    touchId: -1,
    pointerId: -1,
  });

  const railClass =
    "feed-marquee-dots pointer-events-none absolute inset-x-0 z-40 flex items-end justify-center px-3 " +
    (isHero ? "bottom-0 pb-2 pt-10" : "bottom-0 pb-1 pt-8") +
    (isMobileUi ? " feed-marquee-dots--mobile" : "");

  const setCarouselPaused = useCallback(
    (paused: boolean) => {
      onScrubbingChange?.(paused);
    },
    [onScrubbingChange],
  );

  const resetGesture = useCallback(() => {
    scrubRef.current = { active: false, touchId: -1, pointerId: -1 };
    lastHapticIndexRef.current = -1;
    setPillVisible(false);
    setCarouselPaused(false);
    clearScrubScrollStyles();
  }, [clearScrubScrollStyles, setCarouselPaused]);

  const pulseScrubIndex = useCallback((ix: number) => {
    if (ix !== lastHapticIndexRef.current) {
      lastHapticIndexRef.current = ix;
      marketCardHaptic("scrub");
    }
  }, []);

  const applyInstagramScrub = useCallback(
    (viewport: HTMLElement, pill: HTMLElement, clientX: number) => {
      const fraction = scrubFractionFromPillX(pill, clientX);
      const slideW = slideWidthPx(viewport);
      const maxLeft = Math.max(0, (posts.length - 1) * slideW);
      const left = fraction * maxLeft;
      const ix = indexFromFraction(fraction, posts.length);

      scrubScrollTo(left);
      onScrubIndex?.(ix);
      pulseScrubIndex(ix);
      return ix;
    },
    [onScrubIndex, posts.length, pulseScrubIndex, scrubScrollTo],
  );

  const startScrub = useCallback(
    (
      viewport: HTMLElement,
      pill: HTMLElement,
      clientX: number,
      touchId: number,
      pointerId: number,
    ) => {
      if (pullRefreshing || scrubRef.current.active) return;

      pauseForUser();
      setCarouselPaused(true);
      setPillVisible(true);
      marketCardHaptic("press");

      scrubRef.current = { active: true, touchId, pointerId };
      lastHapticIndexRef.current = indexFromFraction(
        scrubFractionFromPillX(pill, clientX),
        posts.length,
      );

      applyInstagramScrub(viewport, pill, clientX);
    },
    [
      applyInstagramScrub,
      pauseForUser,
      posts.length,
      pullRefreshing,
      setCarouselPaused,
    ],
  );

  const endScrub = useCallback(() => {
    if (!scrubRef.current.active) return;
    const el = viewportRef.current;
    const pill = pillRef.current;

    scrubRef.current = { active: false, touchId: -1, pointerId: -1 };
    lastHapticIndexRef.current = -1;
    setPillVisible(false);
    setCarouselPaused(false);
    clearScrubScrollStyles();

    if (el) {
      pauseForUser();
      const w = slideWidthPx(el);
      const finalIx = Math.max(0, Math.min(posts.length - 1, Math.round(el.scrollLeft / w)));
      goToSlide(finalIx);
      onScrubIndex?.(finalIx);
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

  const bindHitListeners = useCallback(() => {
    listenersCleanupRef.current?.();
    listenersCleanupRef.current = null;

    if (!isMobileUi) {
      resetGesture();
      return;
    }

    const viewport = viewportRef.current;
    const hit = hitRef.current;
    const pill = pillRef.current;
    if (!viewport || !hit || !pill || posts.length < 2) return;

    const useCoarseTouch =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshing || e.touches.length !== 1) return;
      e.stopPropagation();
      const t = e.touches[0]!;
      startScrub(viewport, pill, t.clientX, t.identifier, -1);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!scrubRef.current.active || e.touches.length < 1) return;
      const t =
        Array.from(e.touches).find((x) => x.identifier === scrubRef.current.touchId) ??
        e.touches[0];
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      applyInstagramScrub(viewport, pill, t.clientX);
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
      startScrub(viewport, pill, e.clientX, -1, e.pointerId);
      try {
        hit.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!scrubRef.current.active || scrubRef.current.pointerId !== e.pointerId) return;
      e.preventDefault();
      applyInstagramScrub(viewport, pill, e.clientX);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!scrubRef.current.active || scrubRef.current.pointerId !== e.pointerId) return;
      endScrub();
      try {
        hit.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    hit.addEventListener("touchstart", onTouchStart, { passive: false });
    hit.addEventListener("touchmove", onTouchMove, { passive: false });
    hit.addEventListener("touchend", onTouchEnd, { passive: true });
    hit.addEventListener("touchcancel", onTouchEnd, { passive: true });

    if (!useCoarseTouch) {
      hit.addEventListener("pointerdown", onPointerDown);
      hit.addEventListener("pointermove", onPointerMove);
      hit.addEventListener("pointerup", onPointerUp);
      hit.addEventListener("pointercancel", onPointerUp);
    }

    listenersCleanupRef.current = () => {
      hit.removeEventListener("touchstart", onTouchStart);
      hit.removeEventListener("touchmove", onTouchMove);
      hit.removeEventListener("touchend", onTouchEnd);
      hit.removeEventListener("touchcancel", onTouchEnd);
      hit.removeEventListener("pointerdown", onPointerDown);
      hit.removeEventListener("pointermove", onPointerMove);
      hit.removeEventListener("pointerup", onPointerUp);
      hit.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    applyInstagramScrub,
    endScrub,
    isMobileUi,
    posts.length,
    pullRefreshing,
    resetGesture,
    startScrub,
    viewportRef,
  ]);

  useLayoutEffect(() => {
    bindHitListeners();
    const t1 = requestAnimationFrame(() => bindHitListeners());
    const t2 = window.setTimeout(() => bindHitListeners(), 120);
    return () => {
      cancelAnimationFrame(t1);
      window.clearTimeout(t2);
      listenersCleanupRef.current?.();
      resetGesture();
    };
  }, [bindHitListeners, resetGesture, posts.length]);

  useEffect(() => {
    if (!isMobileUi) {
      listenersCleanupRef.current?.();
      resetGesture();
      return;
    }
    bindHitListeners();
  }, [bindHitListeners, isMobileUi, resetGesture]);

  const mobileDotIndices = visibleDotIndices(
    posts.length,
    activeIndex,
    MOBILE_VISIBLE_DOTS,
  );

  if (posts.length < 2) return null;

  if (!isMobileUi) {
    return (
      <div className={railClass}>
        <div className="feed-marquee-scrub-pill pointer-events-none flex items-center justify-center gap-1.5 px-3 py-1.5">
          <DotIndicators posts={posts} activeIndex={activeIndex} />
        </div>
      </div>
    );
  }

  return (
    <div className={railClass}>
      <div
        ref={hitRef}
        className="feed-marquee-scrub-hit pointer-events-auto flex w-full max-w-sm items-center justify-center"
        aria-label="Tap to scrub markets"
      >
        <div
          ref={pillRef}
          data-marquee-dot-scrub=""
          data-no-marquee-gesture="true"
          role="slider"
          aria-label={`Market carousel, ${activeIndex + 1} of ${posts.length}`}
          aria-valuemin={1}
          aria-valuemax={posts.length}
          aria-valuenow={activeIndex + 1}
          className={
            "feed-marquee-scrub-pill flex items-center justify-center gap-2 rounded-full px-5 py-2.5 " +
            (pillVisible
              ? "feed-marquee-scrub-pill--visible feed-marquee-scrub-pill--engaged"
              : "feed-marquee-scrub-pill--hidden")
          }
        >
          <DotIndicators
            posts={posts}
            activeIndex={activeIndex}
            indices={mobileDotIndices}
            compact
            scrubbing={pillVisible}
          />
        </div>
      </div>
    </div>
  );
}
