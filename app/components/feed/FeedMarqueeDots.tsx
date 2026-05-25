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

const DOT_SCRUB_HOLD_MS = 220;
const DOT_SCRUB_DRAG_PX = 10;

type ScrubGesture = {
  armed: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  startScroll: number;
};

/**
 * Dot rail for the market carousel — tap to jump, hold or drag horizontally to scrub.
 * Pointer handling is confined to this wrapper so card swipes and pull-to-refresh stay separate.
 */
export function FeedMarqueeDots({
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
  const [isScrubbing, setIsScrubbing] = useState(false);

  const railRef = useRef<HTMLDivElement | null>(null);
  const scrubTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressDotClickRef = useRef(false);
  const scrubRef = useRef<ScrubGesture>({
    armed: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startScroll: 0,
  });

  const clearScrubTimer = useCallback(() => {
    if (scrubTimerRef.current) {
      clearTimeout(scrubTimerRef.current);
      scrubTimerRef.current = null;
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
      marketCardHaptic("press");
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
    const el = viewportRef.current;
    const rail = railRef.current;
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
    armScrub,
    clearScrubTimer,
    endScrub,
    pauseForUser,
    posts.length,
    pullRefreshing,
    syncIndexFromScroll,
    viewportRef,
  ]);

  if (posts.length < 2) return null;

  return (
    <div
      ref={railRef}
      data-marquee-dots=""
      data-no-marquee-gesture="true"
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
  );
}
