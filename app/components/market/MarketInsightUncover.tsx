"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { MarketContractPayload } from "@/lib/markets/market-contract";
import type { MarketOrderbookPayload } from "@/lib/markets/orderbook-types";

function LevelTable({
  title,
  bids,
  asks,
}: {
  title: string;
  bids: MarketOrderbookPayload["yes"]["bids"];
  asks: MarketOrderbookPayload["yes"]["asks"];
}) {
  return (
    <div className="market-insight-stagger">
      <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="mt-1 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <p className="font-semibold text-emerald-600 dark:text-emerald-400">Bids</p>
          <ul className="mt-0.5 space-y-0.5 tabular-nums">
            {bids.slice(0, 4).map((l) => (
              <li key={`b-${l.priceCents}`} className="flex justify-between gap-2">
                <span>{l.priceCents}¢</span>
                <span className="text-zinc-500">{l.sizeShares.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-red-600 dark:text-red-400">Asks</p>
          <ul className="mt-0.5 space-y-0.5 tabular-nums">
            {asks.slice(0, 4).map((l) => (
              <li key={`a-${l.priceCents}`} className="flex justify-between gap-2">
                <span>{l.priceCents}¢</span>
                <span className="text-zinc-500">{l.sizeShares.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function MarketInsightUncover({
  open,
  loading,
  book,
  rules,
  onClose,
  pullProgress = 0,
}: {
  open: boolean;
  loading: boolean;
  book: MarketOrderbookPayload | null;
  rules: MarketContractPayload | null;
  onClose: () => void;
  /** 0–1 while mobile press-and-pull preview is active */
  pullProgress?: number;
}) {
  const pulling = !open && pullProgress > 0.04;
  const [present, setPresent] = useState(open || pulling);
  const [animatedIn, setAnimatedIn] = useState(false);

  useEffect(() => {
    if (open) {
      setPresent(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimatedIn(true));
      });
      return () => cancelAnimationFrame(id);
    }
    if (pulling) {
      setPresent(true);
      setAnimatedIn(false);
      return undefined;
    }
    setAnimatedIn(false);
    const t = window.setTimeout(() => setPresent(false), 280);
    return () => window.clearTimeout(t);
  }, [open, pulling]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!present) return null;

  const spread = book?.spread;
  const contractHref = rules?.contractUrl ?? (book ? `/m/${book.marketId}/contract` : null);
  const pullPct = Math.round(Math.min(1, Math.max(0, pullProgress)) * 100);
  const pullClip = `inset(${100 - pullPct}% 0 0 0 round 1rem)`;

  return (
    <div
      className={
        "market-insight-uncover absolute inset-0 z-20 flex flex-col overflow-hidden rounded-2xl " +
        (pulling
          ? "market-insight-uncover--pulling"
          : animatedIn
            ? "market-insight-uncover--in"
            : "market-insight-uncover--out")
      }
      style={
        pulling
          ? {
              clipPath: pullClip,
              opacity: 0.45 + pullProgress * 0.5,
            }
          : undefined
      }
      role="dialog"
      aria-modal={open ? true : undefined}
      aria-label="Market depth and rules"
    >
      <div className="market-insight-uncover__sheen pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex min-h-0 flex-1 flex-col bg-white/92 p-3 backdrop-blur-xl dark:bg-zinc-950/94">
        <div className="market-insight-stagger flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              Depth & rules
            </p>
            {spread ? (
              <p className="mt-0.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Yes {spread.yesBidCents}¢–{spread.yesAskCents}¢ · spread {spread.spreadCents}¢
              </p>
            ) : null}
          </div>
          {open ? (
            <button
              type="button"
              data-no-insight-gesture="true"
              onClick={onClose}
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Close
            </button>
          ) : null}
        </div>

        <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {pulling && !open ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div
                className="market-insight-pull-meter h-1 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width] duration-75"
                  style={{ width: `${pullPct}%` }}
                />
              </div>
              <p className="mt-3 text-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {pullPct >= 100
                  ? "Uncovering depth…"
                  : "Keep pulling down"}
              </p>
            </div>
          ) : null}

          {open && loading && !book && !rules ? (
            <p className="py-6 text-center text-xs text-zinc-500">Uncovering market depth…</p>
          ) : null}

          {open && book ? (
            <div className="space-y-3 border-b border-zinc-200/80 pb-3 dark:border-zinc-800">
              <LevelTable title="Yes" bids={book.yes.bids} asks={book.yes.asks} />
              <LevelTable title="No" bids={book.no.bids} asks={book.no.asks} />
            </div>
          ) : null}

          {open && rules ? (
            <div className="market-insight-stagger mt-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                Market rules
              </p>
              <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                {rules.rulesSummary}
              </p>
              <p className="text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                {rules.resolutionCriteria}
              </p>
              {rules.payoutTimeline.length > 0 ? (
                <ol className="space-y-1">
                  {rules.payoutTimeline.map((step) => (
                    <li
                      key={step.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-2 py-1 dark:bg-zinc-900/80"
                    >
                      <span className="text-[10px] font-semibold text-zinc-800 dark:text-zinc-200">
                        {step.label}
                      </span>
                      <span className="text-[9px] font-bold uppercase text-zinc-500">
                        {step.status}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {contractHref ? (
                <Link
                  href={contractHref}
                  data-no-insight-gesture="true"
                  className="inline-block text-[10px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                >
                  Full contract →
                </Link>
              ) : null}
            </div>
          ) : null}

          {open && !loading && !book && !rules ? (
            <p className="py-4 text-center text-xs text-red-600 dark:text-red-400">
              Could not load market insight.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
