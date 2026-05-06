"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { safeJson } from "@/lib/http";

const PINS_SYNC = "peaksees:pins-updated";

export type PinsSyncDetail = { postKey: string; pinned: boolean };

/** Save / repeak via `/api/pins`; keeps all controls for the same `postKey` in sync. */
export function usePostPin(postKey: string) {
  const [pinned, setPinned] = useState(false);
  const [pinning, setPinning] = useState(false);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/pins", { cache: "no-store" });
      const data = (await safeJson<{ pins?: string[] }>(res)) ?? {};
      if (Array.isArray(data.pins)) setPinned(data.pins.includes(postKey));
    } catch {
      // ignore
    }
  }, [postKey]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const res = await fetch("/api/pins", { cache: "no-store" });
        const data = (await safeJson<{ pins?: string[] }>(res)) ?? {};
        if (!cancelled && Array.isArray(data.pins)) setPinned(data.pins.includes(postKey));
      } catch {
        // ignore
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [postKey]);

  useEffect(() => {
    function onSync(e: Event) {
      const ce = e as CustomEvent<PinsSyncDetail>;
      const d = ce.detail;
      if (!d || d.postKey !== postKey) return;
      if (typeof d.pinned === "boolean") setPinned(d.pinned);
    }
    window.addEventListener(PINS_SYNC, onSync as EventListener);
    return () => window.removeEventListener(PINS_SYNC, onSync as EventListener);
  }, [postKey]);

  const toggle = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPinning(true);
    try {
      const res = await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postKey }),
      });
      const data = (await safeJson<{ pinned?: boolean }>(res)) ?? {};
      if (typeof data.pinned === "boolean") {
        setPinned(data.pinned);
        window.dispatchEvent(new CustomEvent<PinsSyncDetail>(PINS_SYNC, { detail: { postKey, pinned: data.pinned } }));
      }
    } catch {
      // ignore
    } finally {
      busyRef.current = false;
      setPinning(false);
    }
  }, [postKey]);

  return { pinned, toggle, refresh, pinning };
}
