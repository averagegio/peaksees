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

const DESKTOP_SCRUB_HOLD_MS = 160;
const SCRUB_DRAG_PX = 5;

type ScrubGesture = {
  armed: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  startScroll: number;
};

function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

function isTouchPointer(e: PointerEvent) {
  return e.pointerType === "touch" || (e.pointerType === "pen" && isCoarsePointer());
}

/**
 * Instagram-style dot pill: hold and drag horizontally to scrub the marquee.
 * Gestures are confined to this wrapper; dots stay compact inside the pill.
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
  const [isScrubbing, setIsScrubbing] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrubRef = useRef<ScrubGesture>({
    armed: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startScroll: 0,
  });

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
    const pill = pillRef.current;
    if (!el || !pill || posts.length < 2) return undefined;

    const onPointerDown = (e: PointerEvent) => {
      if (pullRefreshing) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      pauseForUser();
      clearHoldTimer();
      scrubRef.current = {
        armed: false,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startScroll: el.scrollLeft,
      };

      if (isTouchPointer(e)) {
        armScrub(e.pointerId);
      } else {
        holdTimerRef.current = setTimeout(() => {
          armScrub(e.pointerId);
        }, DESKTOP_SCRUB_HOLD_MS);
      }

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

      if (!scrubRef.current.armed && holdTimerRef.current) {
        if (absDx >= SCRUB_DRAG_PX && absDx > absDy) {
          clearHoldTimer();
          armScrub(e.pointerId, e.clientX);
        } else if (absDy > 12) {
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

    pill.addEventListener("pointerdown", onPointerDown);
    pill.addEventListener("pointermove", onPointerMove, { passive: false });
    pill.addEventListener("pointerup", onPointerUp);
    pill.addEventListener("pointercancel", onPointerUp);

    return () => {
      clearHoldTimer();
      pill.removeEventListener("pointerdown", onPointerDown);
      pill.removeEventListener("pointermove", onPointerMove);
      pill.removeEventListener("pointerup", onPointerUp);
      pill.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    armScrub,
    clearHoldTimer,
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
      ref={pillRef}
      data-marquee-dot-scrub=""
      data-no-marquee-gesture="true"
      role="slider"
      aria-label={`Market carousel, ${activeIndex + 1} of ${posts.length}. Hold and drag sideways to scrub.`}
      aria-valuemin={1}
      aria-valuemax={posts.length}
      aria-valuenow={activeIndex + 1}
      className={
        "feed-marquee-dot-scrub flex items-center justify-center gap-1.5 rounded-full px-3 py-2 " +
        (isHero ? "min-h-9" : "min-h-8") +
        (isScrubbing ? " feed-marquee-dot-scrub--active" : "")
      }
    >
      {posts.map((p, i) => {
        const active = i === activeIndex;
        return (
          <span
            key={`dot-${p.id}`}
            data-marquee-dot=""
            className={
              "block rounded-full motion-safe:transition-all motion-safe:duration-150 " +
              (active
                ? "h-1.5 w-4 bg-sky-500 shadow-[0_0_0_2px_rgba(14,165,233,0.35)] dark:bg-sky-400 " +
                  (isScrubbing ? "scale-125" : "scale-110")
                : "h-1 w-1 bg-zinc-400/80 dark:bg-zinc-500/90 " +
                  (isScrubbing ? "opacity-70" : "opacity-90"))
            }
            aria-hidden
          />
        );
      })}
    </div>
  );
}
