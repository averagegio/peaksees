"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { safeJson } from "@/lib/http";

export function formatPeakpointsUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function PeakpointsWalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      aria-hidden
    >
      <path d="M12 2c5 0 9 1.8 9 4s-4 4-9 4-9-1.8-9-4 4-4 9-4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 6v6c0 2.2 4 4 9 4s9-1.8 9-4V6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12v6c0 2.2 4 4 9 4s9-1.8 9-4v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function notifyPeakpointsUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("peaksees:peakpoints-updated"));
  }
}

export function PeakpointsWalletBadge({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const [balanceCents, setBalanceCents] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/peakpoints", { cache: "no-store" });
      const data = (await safeJson<{ balanceCents?: number }>(res)) ?? {};
      if (res.ok) setBalanceCents(Number(data.balanceCents ?? 0));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("peaksees:peakpoints-updated", onUpdate);
    return () => window.removeEventListener("peaksees:peakpoints-updated", onUpdate);
  }, [refresh]);

  const label =
    balanceCents === null ? "…" : formatPeakpointsUsd(balanceCents);

  return (
    <Link
      href="/peakpoints"
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] font-semibold text-emerald-800 transition hover:bg-emerald-500/[0.14] dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15 " +
        (compact ? "h-10 px-2.5 text-[11px] sm:px-3 sm:text-xs" : "px-3 py-2 text-sm") +
        (className ? ` ${className}` : "")
      }
      aria-label={`Peakpoints wallet balance ${label}`}
      title="Open Peakpoints wallet"
    >
      <PeakpointsWalletIcon className={compact ? "h-4 w-4 shrink-0" : "h-[1.1rem] w-[1.1rem] shrink-0"} />
      <span className="tabular-nums">{label}</span>
    </Link>
  );
}
