"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { marketCardHaptic } from "@/app/lib/haptics";
import { safeJson } from "@/lib/http";
import type { MarketContractPayload } from "@/lib/markets/market-contract";
import type { MarketOrderbookPayload } from "@/lib/markets/orderbook-types";

const REVEAL_PULL_PX = 68;
const PULL_COMMIT_RATIO = 0.78;

function isCoarsePointer() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

function isGestureTarget(t: EventTarget | null) {
  if (!(t instanceof Element)) return false;
  return Boolean(
    t.closest(
      'button, a, input, textarea, select, label, [role="button"], [data-no-insight-gesture="true"]',
    ),
  );
}

type PullGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  verticalLock: boolean;
  committed: boolean;
};

export function useMarketInsightReveal(marketId: string, enabled: boolean) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [book, setBook] = useState<MarketOrderbookPayload | null>(null);
  const [rules, setRules] = useState<MarketContractPayload | null>(null);
  const [pullProgress, setPullProgress] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const pullRef = useRef<PullGesture | null>(null);
  const fetchingRef = useRef(false);

  const fetchInsight = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const id = encodeURIComponent(marketId);
      const [bookRes, rulesRes] = await Promise.all([
        fetch(`/api/markets/${id}/orderbook`, { cache: "no-store" }),
        fetch(`/api/markets/${id}/rules`, { cache: "no-store" }),
      ]);
      const bookData = await safeJson<MarketOrderbookPayload & { error?: string }>(bookRes);
      const rulesData = await safeJson<MarketContractPayload & { error?: string }>(rulesRes);
      if (bookRes.ok && bookData?.marketId) setBook(bookData);
      if (rulesRes.ok && rulesData?.marketId) setRules(rulesData);
      if (bookRes.ok || rulesRes.ok) {
        setOpen(true);
        setPullProgress(0);
        setIsPulling(false);
        marketCardHaptic("reveal");
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [marketId]);

  const reveal = useCallback(() => {
    void fetchInsight();
  }, [fetchInsight]);

  const close = useCallback(() => {
    setOpen(false);
    setPullProgress(0);
    setIsPulling(false);
    pullRef.current = null;
    marketCardHaptic("close");
  }, []);

  const resetPull = useCallback(() => {
    pullRef.current = null;
    setPullProgress(0);
    setIsPulling(false);
  }, []);

  const bindGestures = useCallback(
    (el: HTMLElement | null) => {
      if (!el || !enabled) return undefined;

      const cancelPull = () => {
        resetPull();
      };

      const onPointerDown = (e: PointerEvent) => {
        if (!isCoarsePointer() || isGestureTarget(e.target)) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (open) return;

        pullRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          verticalLock: false,
          committed: false,
        };
        setIsPulling(true);
        marketCardHaptic("press");
      };

      const onPointerMove = (e: PointerEvent) => {
        const g = pullRef.current;
        if (!g || e.pointerId !== g.pointerId || open) return;

        const dy = e.clientY - g.startY;
        const dx = e.clientX - g.startX;

        if (!g.verticalLock) {
          if (Math.abs(dy) < 10 && Math.abs(dx) < 10) return;
          if (Math.abs(dx) > Math.abs(dy) * 1.15) {
            cancelPull();
            return;
          }
          g.verticalLock = true;
          try {
            el.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }

        if (dy <= 0) {
          setPullProgress(0);
          return;
        }

        e.preventDefault();
        const progress = Math.min(1, dy / REVEAL_PULL_PX);
        setPullProgress(progress);

        if (progress >= 1 && !g.committed) {
          g.committed = true;
          marketCardHaptic("pull");
          void fetchInsight();
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        const g = pullRef.current;
        if (!g || e.pointerId !== g.pointerId) return;

        const dy = e.clientY - g.startY;
        const releaseProgress = Math.min(1, Math.max(0, dy / REVEAL_PULL_PX));
        const shouldReveal = g.committed || releaseProgress >= PULL_COMMIT_RATIO;
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }

        if (shouldReveal) {
          void fetchInsight();
        } else {
          setPullProgress(0);
        }

        pullRef.current = null;
        setIsPulling(false);
      };

      const onDblClick = (e: MouseEvent) => {
        if (isCoarsePointer() || isGestureTarget(e.target)) return;
        e.preventDefault();
        void reveal();
      };

      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("pointermove", onPointerMove, { passive: false });
      el.addEventListener("pointerup", onPointerUp);
      el.addEventListener("pointercancel", onPointerUp);
      el.addEventListener("dblclick", onDblClick);

      return () => {
        resetPull();
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerup", onPointerUp);
        el.removeEventListener("pointercancel", onPointerUp);
        el.removeEventListener("dblclick", onDblClick);
      };
    },
    [enabled, open, fetchInsight, reveal, resetPull],
  );

  useEffect(() => {
    if (!open) return;
    resetPull();
  }, [open, resetPull]);

  return {
    open,
    loading,
    book,
    rules,
    close,
    reveal,
    bindGestures,
    pullProgress,
    isPulling,
  };
}
