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

const SCRUB_DRAG_PX = 6;
/** Dots visible inside the mobile scrub pill (sliding window around active card). */
const MOBILE_VISIBLE_DOTS = 5;

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

function visibleDotIndices(count: number, active: number, maxVisible: number) {
  if (count <= maxVisible) {
    return Array.from({ length: count }, (_, i) => i);
  }
  const half = Math.floor(maxVisible / 2);
  const start = Math.max(0, Math.min(active - half, count - maxVisible));
  return Array.from({ length: maxVisible }, (_, i) => start + i);
}

function DotIndicators({
  posts,
  activeIndex,
  indices,
  compact,
  engaged,
}: {
  posts: MarketPost[];
  activeIndex: number;
  indices?: number[];
  compact?: boolean;
  engaged?: boolean;
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
                  ? "h-1 w-2.5 bg-emerald-600 dark:bg-emerald-400 " + (engaged ? "scale-110" : "")
                  : "h-0.5 w-1 bg-zinc-300/90 dark:bg-zinc-600"
                : active
                  ? "h-1 w-4 bg-emerald-600 dark:bg-emerald-400 " + (engaged ? "scale-110" : "")
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
 * Mobile: small transparent pill with a few dots; outline on tap + drag to scrub.
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
  const [isTouched, setIsTouched] = useState(false);

  const pillRef = useRef<HTMLDivElement | null>(null);
  const scrubRef = useRef<ScrubGesture>({
    armed: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startScroll: 0,
  });

  const railClass =
    "feed-marquee-dots pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center px-3 " +
    (isHero ? "bottom-0 pb-3 pt-8" : "bottom-0 pb-2 pt-6");

  const engaged = isScrubbing || isTouched;

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
      setIsTouched(false);
      return undefined;
    }

    const el = viewportRef.current;
    const pill = pillRef.current;
    if (!el || !pill || posts.length < 2) return undefined;

    const onPointerDown = (e: PointerEvent) => {
      if (pullRefreshing || e.pointerType === "mouse") return;

      pauseForUser();
      setIsTouched(true);
      marketCardHaptic("press");

      scrubRef.current = {
        armed: false,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startScroll: el.scrollLeft,
      };

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
        }
        return;
      }

      e.preventDefault();
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      el.scrollLeft = Math.max(
        0,
        Math.min(maxScroll, scrubRef.current.startScroll - dx),
      );
      syncIndexFromScroll();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== scrubRef.current.pointerId) return;
      setIsTouched(false);
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
      pill.removeEventListener("pointerdown", onPointerDown);
      pill.removeEventListener("pointermove", onPointerMove);
      pill.removeEventListener("pointerup", onPointerUp);
      pill.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    armScrub,
    endScrub,
    isMobile,
    pauseForUser,
    posts.length,
    pullRefreshing,
    setScrubbing,
    syncIndexFromScroll,
    viewportRef,
  ]);

  const mobileDotIndices = visibleDotIndices(
    posts.length,
    activeIndex,
    MOBILE_VISIBLE_DOTS,
  );

  const showOutline = isMobile && (isTouched || isScrubbing);

  const pillClass =
    "feed-marquee-scrub-pill flex items-center justify-center rounded-full " +
    (isMobile
      ? "gap-1 px-2 py-1 min-h-7 " + (showOutline ? "feed-marquee-scrub-pill--outline" : "")
      : "gap-1.5 px-3 py-1.5 pointer-events-none ");

  if (posts.length < 2) return null;

  return (
    <div className={railClass} aria-hidden={!isMobile}>
      <div
        ref={isMobile ? pillRef : undefined}
        data-marquee-dot-scrub={isMobile ? "" : undefined}
        data-no-marquee-gesture={isMobile ? "true" : undefined}
        role={isMobile ? "slider" : undefined}
        aria-label={
          isMobile
            ? `Market carousel, ${activeIndex + 1} of ${posts.length}`
            : undefined
        }
        aria-valuemin={isMobile ? 1 : undefined}
        aria-valuemax={isMobile ? posts.length : undefined}
        aria-valuenow={isMobile ? activeIndex + 1 : undefined}
        className={pillClass}
      >
        <DotIndicators
          posts={posts}
          activeIndex={activeIndex}
          indices={isMobile ? mobileDotIndices : undefined}
          compact={isMobile}
          engaged={isMobile ? engaged : false}
        />
      </div>
    </div>
  );
}
