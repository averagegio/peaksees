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

/** Min horizontal movement before scrub engages (avoids accidental arms). */
const SCRUB_ARM_PX = 10;
/** ~55% of viewport width dragged = move one card (slower, easier to control). */
const SCRUB_VIEWPORT_PER_CARD = 0.55;
const MOBILE_VISIBLE_DOTS = 5;

type ScrubGesture = {
  armed: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  startIndex: number;
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

function scrollToIndex(viewport: HTMLElement, index: number, count: number) {
  const w = slideWidthPx(viewport);
  const ix = Math.max(0, Math.min(count - 1, index));
  const left = ix * w;
  viewport.scrollTo({ left, behavior: "auto" });
  return ix;
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
 * Mobile: tap pill, drag sideways to scrub. Index tracks carousel 1:1 (not scrollWidth).
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
  /** Immediate index sync for pill dots + badge while dragging. */
  onScrubIndex?: (index: number) => void;
  onScrubbingChange?: (scrubbing: boolean) => void;
}) {
  const isHero = variant === "hero";
  const isMobileUi = useTouchScrubUi();
  const [isScrubbing, setIsScrubbing] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);
  const listenersCleanupRef = useRef<(() => void) | null>(null);
  const lastHapticIndexRef = useRef(-1);
  const scrubRef = useRef<ScrubGesture>({
    armed: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startIndex: 0,
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

  const resetGesture = useCallback(() => {
    scrubRef.current = {
      armed: false,
      pointerId: -1,
      startX: 0,
      startY: 0,
      startIndex: 0,
    };
    lastHapticIndexRef.current = -1;
    setScrubbing(false);
  }, [setScrubbing]);

  const pulseScrubIndex = useCallback(
    (ix: number) => {
      if (ix !== lastHapticIndexRef.current) {
        lastHapticIndexRef.current = ix;
        marketCardHaptic("scrub");
      }
    },
    [],
  );

  const applyScrubFromDrag = useCallback(
    (viewport: HTMLElement, dx: number) => {
      const slideW = slideWidthPx(viewport);
      const pxPerCard = Math.max(slideW * SCRUB_VIEWPORT_PER_CARD, 48);
      const deltaCards = -dx / pxPerCard;
      const ix = Math.round(scrubRef.current.startIndex + deltaCards);
      const clamped = Math.max(0, Math.min(posts.length - 1, ix));
      const settled = scrollToIndex(viewport, clamped, posts.length);
      onScrubIndex?.(settled);
      pulseScrubIndex(settled);
      return settled;
    },
    [onScrubIndex, posts.length, pulseScrubIndex],
  );

  const armScrub = useCallback(
    (pointerId: number, pill: HTMLElement) => {
      if (scrubRef.current.armed) return;
      scrubRef.current.armed = true;
      lastHapticIndexRef.current = scrubRef.current.startIndex;
      setScrubbing(true);
      try {
        pill.setPointerCapture(pointerId);
      } catch {
        // ignore
      }
      marketCardHaptic("pull");
    },
    [setScrubbing],
  );

  const endScrub = useCallback(
    (pointerId: number, pill: HTMLElement | null) => {
      const el = viewportRef.current;
      const wasArmed = scrubRef.current.armed;
      scrubRef.current.armed = false;
      setScrubbing(false);
      lastHapticIndexRef.current = -1;

      if (pill) {
        try {
          pill.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
      }
      if (el && wasArmed) {
        pauseForUser();
        const ix = indexFromScroll(el, posts.length);
        goToSlide(ix);
        onScrubIndex?.(ix);
      }
    },
    [goToSlide, onScrubIndex, pauseForUser, posts.length, setScrubbing, viewportRef],
  );

  const bindPillListeners = useCallback(() => {
    listenersCleanupRef.current?.();
    listenersCleanupRef.current = null;

    if (!isMobileUi) {
      resetGesture();
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
      const startIx = indexFromScroll(el, posts.length);
      scrubRef.current = {
        armed: false,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startIndex: startIx,
      };
      lastHapticIndexRef.current = startIx;
      setScrubbing(false);

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
        if (absDx >= SCRUB_ARM_PX && absDx >= absDy * 1.05) {
          armScrub(e.pointerId, pill);
        }
        return;
      }

      e.preventDefault();
      applyScrubFromDrag(el, dx);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== scrubRef.current.pointerId) return;
      endScrub(e.pointerId, pill);
      scrubRef.current.pointerId = -1;
    };

    pill.addEventListener("touchstart", onTouchStart, { passive: true });
    pill.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove, {
      passive: false,
      capture: true,
    });
    document.addEventListener("pointerup", onPointerUp, { capture: true });
    document.addEventListener("pointercancel", onPointerUp, { capture: true });

    listenersCleanupRef.current = () => {
      pill.removeEventListener("touchstart", onTouchStart);
      pill.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove, { capture: true });
      document.removeEventListener("pointerup", onPointerUp, { capture: true });
      document.removeEventListener("pointercancel", onPointerUp, { capture: true });
    };
  }, [
    applyScrubFromDrag,
    armScrub,
    endScrub,
    isMobileUi,
    pauseForUser,
    posts.length,
    pullRefreshing,
    resetGesture,
    setScrubbing,
    viewportRef,
  ]);

  const setPillRef = useCallback(
    (node: HTMLDivElement | null) => {
      pillRef.current = node;
      if (node) {
        bindPillListeners();
      }
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

  const pillClass =
    "feed-marquee-scrub-pill flex items-center justify-center rounded-full " +
    (isMobileUi
      ? "pointer-events-auto gap-1.5 px-2.5 py-1.5 min-h-8 min-w-[3.25rem] " +
        (isScrubbing ? "feed-marquee-scrub-pill--outline" : "")
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
          scrubbing={isMobileUi && isScrubbing}
        />
      </div>
    </div>
  );
}
