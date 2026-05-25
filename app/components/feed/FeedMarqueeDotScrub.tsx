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
/** Side inset when mapping finger X across the hit zone (wider = more responsive). */
const SCRUB_HIT_EDGE_INSET_RATIO = 0.12;

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

function scrubFractionFromHit(hit: HTMLElement, clientX: number) {
  const rect = hit.getBoundingClientRect();
  const inset = Math.max(12, rect.width * SCRUB_HIT_EDGE_INSET_RATIO);
  const usable = Math.max(1, rect.width - inset * 2);
  const localX = clientX - rect.left - inset;
  return Math.max(0, Math.min(1, localX / usable));
}

function indexFromFraction(fraction: number, count: number) {
  if (count <= 1) return 0;
  const max = count - 1;
  return Math.min(max, Math.round(fraction * max));
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
              compact
                ? (active
                    ? "feed-marquee-scrub-dot feed-marquee-scrub-dot--active" +
                      (scrubbing ? " feed-marquee-scrub-dot--scrubbing" : "")
                    : "feed-marquee-scrub-dot")
                : "block rounded-full motion-safe:transition-all motion-safe:duration-150 " +
                  (active
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
  viewportReady = false,
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
  /** Re-bind listeners once marquee viewport has measured width. */
  viewportReady?: boolean;
}) {
  const isHero = variant === "hero";
  const isMobileUi = useTouchScrubUi();
  const [pillVisible, setPillVisible] = useState(false);

  const hitRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const listenersCleanupRef = useRef<(() => void) | null>(null);
  const lastHapticIndexRef = useRef(-1);
  const lastScrubIndexRef = useRef(-1);
  const scrubRef = useRef<ScrubGesture>({
    active: false,
    touchId: -1,
    pointerId: -1,
  });

  const railClass =
    "feed-marquee-dots absolute inset-x-0 bottom-0 z-30 flex items-end justify-center " +
    (isMobileUi ? "feed-marquee-dots--mobile pointer-events-auto " : "pointer-events-none ") +
    (isHero ? "pb-1" : "pb-0");

  const setPillScrubbingDom = useCallback((scrubbing: boolean) => {
    const pill = pillRef.current;
    if (!pill) return;
    pill.classList.toggle("feed-marquee-scrub-pill--scrubbing", scrubbing);
  }, []);

  const setCarouselPaused = useCallback(
    (paused: boolean) => {
      onScrubbingChange?.(paused);
    },
    [onScrubbingChange],
  );

  const resetGesture = useCallback(() => {
    scrubRef.current = { active: false, touchId: -1, pointerId: -1 };
    lastHapticIndexRef.current = -1;
    lastScrubIndexRef.current = -1;
    setPillVisible(false);
    setPillScrubbingDom(false);
    setCarouselPaused(false);
    clearScrubScrollStyles();
  }, [clearScrubScrollStyles, setCarouselPaused, setPillScrubbingDom]);

  const pulseScrubIndex = useCallback((ix: number) => {
    if (ix !== lastHapticIndexRef.current) {
      lastHapticIndexRef.current = ix;
      marketCardHaptic("scrub");
    }
  }, []);

  const applyInstagramScrub = useCallback(
    (viewport: HTMLElement, hit: HTMLElement, clientX: number) => {
      const fraction = scrubFractionFromHit(hit, clientX);
      const ix = indexFromFraction(fraction, posts.length);

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
    (
      viewport: HTMLElement,
      _hitEl: HTMLElement,
      clientX: number,
      touchId: number,
      pointerId: number,
    ) => {
      if (pullRefreshing || scrubRef.current.active) return;

      pauseForUser();
      setCarouselPaused(true);
      setPillVisible(true);
      setPillScrubbingDom(true);
      marketCardHaptic("press");

      scrubRef.current = { active: true, touchId, pointerId };
      const hit = hitRef.current;
      if (!hit) return;

      lastScrubIndexRef.current = indexFromFraction(
        scrubFractionFromHit(hit, clientX),
        posts.length,
      );

      applyInstagramScrub(viewport, hit, clientX);
    },
    [
      applyInstagramScrub,
      pauseForUser,
      posts.length,
      pullRefreshing,
      setCarouselPaused,
      setPillScrubbingDom,
    ],
  );

  const endScrub = useCallback(() => {
    if (!scrubRef.current.active) return;
    const el = viewportRef.current;
    const pill = pillRef.current;

    scrubRef.current = { active: false, touchId: -1, pointerId: -1 };
    lastHapticIndexRef.current = -1;
    lastScrubIndexRef.current = -1;
    setPillVisible(false);
    setPillScrubbingDom(false);
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
    setPillScrubbingDom,
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
    if (!viewport || !hit || posts.length < 2) return;

    const useCoarseTouch =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;

    const onTouchStart = (e: TouchEvent) => {
      if (pullRefreshing || e.touches.length !== 1) return;
      e.stopPropagation();
      e.preventDefault();
      const t = e.touches[0]!;
      startScrub(viewport, hit, t.clientX, t.identifier, -1);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!scrubRef.current.active || e.touches.length < 1) return;
      const t =
        Array.from(e.touches).find((x) => x.identifier === scrubRef.current.touchId) ??
        e.touches[0];
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      applyInstagramScrub(viewport, hit, t.clientX);
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
      startScrub(viewport, hit, e.clientX, -1, e.pointerId);
      try {
        hit.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!scrubRef.current.active || scrubRef.current.pointerId !== e.pointerId) return;
      e.preventDefault();
      applyInstagramScrub(viewport, hit, e.clientX);
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

    hit.addEventListener("touchstart", onTouchStart, { capture: true, passive: false });
    hit.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    hit.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
    hit.addEventListener("touchcancel", onTouchEnd, { capture: true, passive: true });

    if (!useCoarseTouch) {
      hit.addEventListener("pointerdown", onPointerDown);
      hit.addEventListener("pointermove", onPointerMove);
      hit.addEventListener("pointerup", onPointerUp);
      hit.addEventListener("pointercancel", onPointerUp);
    }

    listenersCleanupRef.current = () => {
      hit.removeEventListener("touchstart", onTouchStart, { capture: true });
      hit.removeEventListener("touchmove", onTouchMove, { capture: true });
      hit.removeEventListener("touchend", onTouchEnd, { capture: true });
      hit.removeEventListener("touchcancel", onTouchEnd, { capture: true });
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
  }, [bindHitListeners, resetGesture, posts.length, viewportReady]);

  useEffect(() => {
    if (!isMobileUi) {
      listenersCleanupRef.current?.();
      resetGesture();
      return;
    }
    bindHitListeners();
  }, [bindHitListeners, isMobileUi, resetGesture, viewportReady]);

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
        data-marquee-dot-scrub=""
        data-no-marquee-gesture="true"
        className="feed-marquee-scrub-hit pointer-events-auto"
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
            "feed-marquee-scrub-pill feed-marquee-scrub-pill--idle flex items-center justify-center gap-2 rounded-full px-5 py-2.5 " +
            (pillVisible ? "feed-marquee-scrub-pill--scrubbing" : "")
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
