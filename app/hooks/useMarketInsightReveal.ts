"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { marketCardHaptic } from "@/app/lib/haptics";
import { safeJson } from "@/lib/http";
import type { MarketContractPayload } from "@/lib/markets/market-contract";
import type { MarketOrderbookPayload } from "@/lib/markets/orderbook-types";

const HOLD_MS = 480;
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

export function useMarketInsightReveal(marketId: string, enabled: boolean) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [book, setBook] = useState<MarketOrderbookPayload | null>(null);
  const [rules, setRules] = useState<MarketContractPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdFiredRef = useRef(false);

  const fetchInsight = useCallback(async () => {
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
        marketCardHaptic("reveal");
      }
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  const reveal = useCallback(() => {
    if (open) {
      void fetchInsight();
      return;
    }
    void fetchInsight();
  }, [open, fetchInsight]);

  const close = useCallback(() => {
    setOpen(false);
    marketCardHaptic("close");
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const bindGestures = useCallback(
    (el: HTMLElement | null) => {
      if (!el || !enabled) return undefined;

      const onPointerDown = (e: PointerEvent) => {
        if (!isCoarsePointer() || isGestureTarget(e.target)) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        holdFiredRef.current = false;
        clearTimer();
        marketCardHaptic("press");
        timerRef.current = setTimeout(() => {
          holdFiredRef.current = true;
          void fetchInsight();
        }, HOLD_MS);
      };

      const onPointerUp = () => clearTimer();

      const onPointerMove = () => {
        if (!holdFiredRef.current) clearTimer();
      };

      const onContextMenu = (e: Event) => {
        if (holdFiredRef.current) e.preventDefault();
      };

      const onDblClick = (e: MouseEvent) => {
        if (isCoarsePointer() || isGestureTarget(e.target)) return;
        e.preventDefault();
        void reveal();
      };

      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("pointerup", onPointerUp);
      el.addEventListener("pointercancel", onPointerUp);
      el.addEventListener("pointerleave", onPointerUp);
      el.addEventListener("pointermove", onPointerMove);
      el.addEventListener("contextmenu", onContextMenu);
      el.addEventListener("dblclick", onDblClick);

      return () => {
        clearTimer();
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointerup", onPointerUp);
        el.removeEventListener("pointercancel", onPointerUp);
        el.removeEventListener("pointerleave", onPointerUp);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("contextmenu", onContextMenu);
        el.removeEventListener("dblclick", onDblClick);
      };
    },
    [enabled, clearTimer, fetchInsight, reveal],
  );

  return { open, loading, book, rules, close, bindGestures };
}
