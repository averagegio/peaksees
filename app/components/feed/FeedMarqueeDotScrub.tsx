"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { marketCardHaptic } from "@/app/lib/haptics";
import type { MarketPost } from "@/app/lib/mock-markets";

const SCRUB_HOLD_MS = 220;
const SCRUB_DRAG_PX = 8;

type ScrubGesture = {
  armed: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  startScroll: number;
};

function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return coarse;
}

function DotIndicators({
  posts,
  activeIndex,
  isScrubbing,
}: {
  posts: MarketPost[];
  activeIndex: number;
  isScrubbing?: boolean;
}) {
  return (
    <>
      {posts.map((p, i) => {
        const active = i === activeIndex;
        return (
          <span
            key={`dot-${p.id}`}
            data-marquee-dot=""
            className={
              "block rounded-full motion-safe:transition-all motion-safe:duration-200 " +
              (active
                ? "h-1 w-4 bg-emerald-600 dark:bg-emerald-400 " +
                  (isScrubbing ? "scale-110" : "")
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
 * Compact dots under the market card. Mobile: tap-hold + horizontal drag to scrub.
 * Desktop: display-only indicators (no scrub).
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
  const isMobile = useCoarsePointer();
  const [isScrubbing, setIsScrubbing] = useState(false);

  const railRef = useRef<HTMLDivElement | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubRef = useRef<ScrubGesture>({
    armed: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startScroll: 0,
  });

  const railClass =
    "feed-marquee-dots absolute inset-x-0 z-10 flex items-center justify-center gap-1.5 px-3 " +
    (isHero ? "bottom-0 pb-3 pt-8" : "bottom-0 pb-2 pt-6");

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const setScrubbing = useCallback(
    (scrubbing: boolean) => {
      setIsScrubbing(scrubbing);
      onScrubbingChange?.(scrubbing);
    },
    [onScrubbingChange],
  );

  const armScrub = useCallback(
    (pointerId: number, clientX?: number) => {
      const el = viewportRef.current;
      if (!el || scrubRef.current.armed) return;
      if (clientX != null) {
        scrubRef.current.startX = clientX;
        scrubRef.current.startScroll = el.scrollLeft;
      }
      scrubRef.current.armed = true;
      setScrubbing(true);
      try {
        el.setPointerCapture(pointerId);
      } catch {
        // ignore
      }
      marketCardHaptic("pull");
    },
    [setScrubbing, viewportRef],
  );

  const endScrub = useCallback(
    (pointerId: number) => {
      const el = viewportRef.current;
      if (!scrubRef.current.armed) return;
      scrubRef.current.armed = false;
      setScrubbing(false);
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
          goToSlide(ix);
        }
      }
    },
    [goToSlide, pauseForUser, posts.length, setScrubbing, viewportRef],
  );

  useEffect(() => {
    if (!isMobile) {
      setScrubbing(false);
      return undefined;
    }

    const el = viewportRef.current;
    const rail = railRef.current;
    if (!el || !rail || posts.length < 2) return undefined;

    const onPointerDown = (e: PointerEvent) => {
      if (pullRefreshing || e.pointerType === "mouse") return;

      pauseForUser();
      clearHoldTimer();
      marketCardHaptic("press");

      scrubRef.current = {
        armed: false,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startScroll: el.scrollLeft,
      };

      holdTimerRef.current = setTimeout(() => {
        armScrub(e.pointerId);
      }, SCRUB_HOLD_MS);

      try {
        rail.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== scrubRef.current.pointerId) return;

      const dx = e.clientX - scrubRef.current.startX;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(e.clientY - scrubRef.current.startY);

      if (!scrubRef.current.armed && holdTimerRef.current) {
        if (absDx >= SCRUB_DRAG_PX && absDx > absDy) {
          clearHoldTimer();
          armScrub(e.pointerId, e.clientX);
        } else if (absDy > 14) {
          clearHoldTimer();
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

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== scrubRef.current.pointerId) return;
      clearHoldTimer();
      if (scrubRef.current.armed) {
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

    rail.addEventListener("pointerdown", onPointerDown);
    rail.addEventListener("pointermove", onPointerMove, { passive: false });
    rail.addEventListener("pointerup", onPointerUp);
    rail.addEventListener("pointercancel", onPointerUp);

    return () => {
      clearHoldTimer();
      rail.removeEventListener("pointerdown", onPointerDown);
      rail.removeEventListener("pointermove", onPointerMove);
      rail.removeEventListener("pointerup", onPointerUp);
      rail.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    armScrub,
    clearHoldTimer,
    endScrub,
    isMobile,
    pauseForUser,
    posts.length,
    pullRefreshing,
    setScrubbing,
    syncIndexFromScroll,
    viewportRef,
  ]);

  if (posts.length < 2) return null;

  if (!isMobile) {
    return (
      <div className={railClass + " pointer-events-none"} aria-hidden>
        <DotIndicators posts={posts} activeIndex={activeIndex} />
      </div>
    );
  }

  return (
    <div
      ref={railRef}
      data-marquee-dot-scrub=""
      data-no-marquee-gesture="true"
      role="slider"
      aria-label={`Market carousel, ${activeIndex + 1} of ${posts.length}`}
      aria-valuemin={1}
      aria-valuemax={posts.length}
      aria-valuenow={activeIndex + 1}
      className={
        railClass +
        (isScrubbing ? " feed-marquee-dots--scrubbing" : "")
      }
    >
      <DotIndicators posts={posts} activeIndex={activeIndex} isScrubbing={isScrubbing} />
    </div>
  );
}
