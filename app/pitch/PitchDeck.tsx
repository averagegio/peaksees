"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PEAKSEES_BG_LOOP, PEAKSEES_HEADER_BANNER_DARK, FEED_TAGLINE } from "@/lib/brand";
import {
  FUNNEL,
  FUNDING_ROUNDS,
  GROWTH_ALLOCATION,
  MAU_SERIES,
  PEAK_AI,
  PRESEED_ASK,
  TAM,
} from "@/app/pitch/pitch-data";

function SlideShell({
  kicker,
  title,
  children,
  wide,
}: {
  kicker?: string;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={
        "pitch-enter mx-auto flex h-full w-full flex-col justify-center px-5 py-16 sm:px-10 " +
        (wide ? "max-w-6xl" : "max-w-5xl")
      }
    >
      {kicker ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--pitch-mint)]">
          {kicker}
        </p>
      ) : null}
      <h2 className="pitch-display mt-3 text-3xl font-semibold leading-[1.05] text-[var(--pitch-fog)] sm:text-5xl">
        {title}
      </h2>
      <div className="mt-8 min-h-0 flex-1">{children}</div>
    </div>
  );
}

function HeroSlide() {
  return (
    <div className="relative flex h-full w-full items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF atmosphere */}
        <img
          src={PEAKSEES_BG_LOOP}
          alt=""
          className="h-full w-full object-cover opacity-40 saturate-125"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--pitch-ink)] via-[var(--pitch-ink)]/70 to-[var(--pitch-ink)]/30" />
        <div className="pitch-brand-glow absolute inset-x-0 bottom-0 h-1/2 opacity-70" />
      </div>

      <div className="pitch-enter relative z-10 mx-auto flex w-full max-w-5xl flex-col items-start justify-center px-5 py-16 sm:px-10">
        <Image
          src={PEAKSEES_HEADER_BANNER_DARK}
          alt="peaksees"
          width={720}
          height={220}
          priority
          className="h-auto w-[min(100%,26rem)] object-contain drop-shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        />
        <h1 className="pitch-display mt-10 max-w-3xl text-3xl font-semibold leading-[1.08] text-[var(--pitch-fog)] sm:text-5xl lg:text-6xl">
          {FEED_TAGLINE}
        </h1>
      </div>
    </div>
  );
}

function TamSlide() {
  const tiers = [TAM.tam, TAM.sam, TAM.som];
  return (
    <SlideShell kicker="Market size" title="TAM → SAM → SOM">
      <div className="grid gap-6 sm:grid-cols-3">
        {tiers.map((tier, i) => (
          <div
            key={tier.label}
            className="border-t border-[var(--pitch-line)] pt-5"
            style={{ animationDelay: `${0.12 + i * 0.08}s` }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--pitch-mint)]">
              {tier.label}
            </p>
            <p className="pitch-display mt-3 text-4xl font-semibold text-[var(--pitch-fog)] sm:text-5xl">
              {tier.value}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--pitch-fog)]/70">
              {tier.detail}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-10 max-w-2xl text-sm leading-relaxed text-[var(--pitch-fog)]/60">
        Peaksees sits where social feeds and prediction markets meet: every post can
        become a priced conviction with Yes/No shares, escrow, and public resolution.
      </p>
    </SlideShell>
  );
}

function MauSlide() {
  const max = MAU_SERIES[MAU_SERIES.length - 1]!.mau;
  const lastIndex = MAU_SERIES.length - 1;
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const activeRow = MAU_SERIES[active]!;
  const prevRow = active > 0 ? MAU_SERIES[active - 1] : null;

  useEffect(() => {
    if (!playing) return undefined;
    if (active >= lastIndex) {
      const pause = window.setTimeout(() => setPlaying(false), 900);
      return () => window.clearTimeout(pause);
    }
    const id = window.setTimeout(() => setActive((i) => Math.min(lastIndex, i + 1)), 1100);
    return () => window.clearTimeout(id);
  }, [playing, active, lastIndex]);

  return (
    <SlideShell kicker="Traction model" title="Monthly active users">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--pitch-fog)]/45">
            Selected horizon
          </p>
          <p className="pitch-display mt-1 text-4xl font-semibold text-[var(--pitch-mint)] sm:text-5xl">
            {activeRow.label}
            <span className="ml-3 text-lg font-medium text-[var(--pitch-fog)]/55 sm:text-xl">
              MAU · {activeRow.year}
            </span>
          </p>
          {activeRow.growth && prevRow ? (
            <p className="mt-2 text-sm text-[var(--pitch-gold)]">
              {activeRow.growth} vs {prevRow.year} ({prevRow.label} → {activeRow.label})
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--pitch-fog)]/55">Baseline year — growth compounds from here</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (active >= lastIndex) setActive(0);
              setPlaying((p) => !p || active >= lastIndex);
            }}
            className="border border-[var(--pitch-line)] bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition hover:bg-white/10"
            aria-pressed={playing}
          >
            {playing && active < lastIndex ? "Pause" : active >= lastIndex ? "Replay growth" : "Play growth"}
          </button>
        </div>
      </div>

      <div
        className="mt-6 flex h-52 items-end gap-2 sm:h-64 sm:gap-4"
        role="listbox"
        aria-label="MAU by year"
        aria-activedescendant={`mau-${activeRow.year}`}
      >
        {MAU_SERIES.map((row, i) => {
          const height = Math.max(10, Math.round((row.mau / max) * 100));
          const revealed = i <= active;
          const isActive = i === active;
          return (
            <button
              key={row.year}
              id={`mau-${row.year}`}
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => {
                setPlaying(false);
                setActive(i);
              }}
              className={
                "group flex flex-1 flex-col items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--pitch-mint)] " +
                (revealed ? "opacity-100" : "opacity-35")
              }
            >
              <span
                className={
                  "text-sm font-semibold transition " +
                  (isActive ? "text-[var(--pitch-mint)]" : "text-[var(--pitch-fog)]/70")
                }
              >
                {revealed ? row.label : "—"}
              </span>
              <span className="relative flex h-full w-full items-end justify-center">
                <span
                  className={
                    "w-full max-w-[4.5rem] rounded-t-md transition-[height,opacity,filter] duration-500 ease-out " +
                    (isActive
                      ? "bg-gradient-to-t from-[var(--pitch-mint-deep)] to-[var(--pitch-mint)] shadow-[0_0_24px_rgba(31,169,122,0.35)]"
                      : revealed
                        ? "bg-gradient-to-t from-[var(--pitch-mint-deep)]/70 to-[var(--pitch-mint)]/70"
                        : "bg-[var(--pitch-fog)]/15")
                  }
                  style={{ height: revealed ? `${height}%` : "8%" }}
                />
              </span>
              <span
                className={
                  "text-xs font-semibold uppercase tracking-[0.14em] " +
                  (isActive ? "text-[var(--pitch-fog)]" : "text-[var(--pitch-fog)]/45")
                }
              >
                {row.year}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <label className="flex items-center gap-3 text-xs text-[var(--pitch-fog)]/55">
          <span className="shrink-0 uppercase tracking-[0.14em]">Scrub</span>
          <input
            type="range"
            min={0}
            max={lastIndex}
            step={1}
            value={active}
            onChange={(e) => {
              setPlaying(false);
              setActive(Number(e.target.value));
            }}
            className="pitch-mau-scrub h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--pitch-mint)]"
            aria-label="Scrub MAU growth by year"
          />
          <span className="shrink-0 font-semibold text-[var(--pitch-fog)]/80">{activeRow.year}</span>
        </label>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--pitch-fog)]/65">
          {activeRow.note}. Growth compounds from feed habit → first trade → Peakpoints
          deposits → returning depth traders.
        </p>
      </div>
    </SlideShell>
  );
}

function FunnelSlide() {
  return (
    <SlideShell kicker="Growth engine" title="Sales & conversion funnel">
      <ol className="space-y-0">
        {FUNNEL.map((step, i) => (
          <li
            key={step.stage}
            className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 border-b border-[var(--pitch-line)] py-3.5 sm:gap-6"
          >
            <span className="pitch-display w-6 text-lg text-[var(--pitch-gold)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <p className="text-base font-semibold text-[var(--pitch-fog)] sm:text-lg">
                {step.stage}
              </p>
              <p className="mt-0.5 text-sm text-[var(--pitch-fog)]/55">{step.note}</p>
            </div>
            <p className="pitch-display text-right text-lg font-semibold text-[var(--pitch-mint)] sm:text-xl">
              {step.rate}
            </p>
          </li>
        ))}
      </ol>
    </SlideShell>
  );
}

function PeakAiSlide() {
  return (
    <SlideShell kicker="Intelligence" title="Peak AI">
      <p className="max-w-2xl text-sm leading-relaxed text-[var(--pitch-fog)]/75">
        {PEAK_AI.tagline}. Handle {PEAK_AI.handle} is the always-on publisher that
        turns live signals into tradeable feed inventory.
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {PEAK_AI.pillars.map((pillar) => (
          <div key={pillar.title} className="border-t border-[var(--pitch-line)] pt-5">
            <p className="pitch-display text-2xl text-[var(--pitch-mint)]">{pillar.title}</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--pitch-fog)]/70">
              {pillar.body}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-10 max-w-2xl text-sm leading-relaxed text-[var(--pitch-fog)]/60">
        {PEAK_AI.flywheel}
      </p>
    </SlideShell>
  );
}

function DepthCardsSlide() {
  return (
    <SlideShell kicker="Product" title="Market cards & depth">
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <p className="text-sm leading-relaxed text-[var(--pitch-fog)]/75">
            Each feed card is a live Yes/No market: question, volume, implied odds,
            and settle time — swipeable like a social story, tradeable like a book.
          </p>
          <ul className="mt-6 space-y-4 text-sm text-[var(--pitch-fog)]/80">
            <li className="border-l-2 border-[var(--pitch-mint)] pl-4">
              <span className="font-semibold text-[var(--pitch-fog)]">Surface layer</span>
              <br />
              Probabilities, volume, and creator context without leaving the feed.
            </li>
            <li className="border-l-2 border-[var(--pitch-gold)] pl-4">
              <span className="font-semibold text-[var(--pitch-fog)]">Depth reveal</span>
              <br />
              Tap the depth control, double-click, or pull down to open order book,
              contract rules, and payout timeline.
            </li>
            <li className="border-l-2 border-[var(--pitch-mint)] pl-4">
              <span className="font-semibold text-[var(--pitch-fog)]">Why it matters</span>
              <br />
              Depth turns scrolling into informed conviction — spreads and size stay
              one gesture away.
            </li>
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-none border border-[var(--pitch-line)] bg-[var(--pitch-panel)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--pitch-mint)]">
            Card anatomy
          </p>
          <p className="pitch-display mt-4 text-xl leading-snug">
            Will Peak AI markets outpace user-created peaks this week?
          </p>
          <div className="mt-6 flex gap-6 text-sm">
            <div>
              <p className="text-[var(--pitch-fog)]/45">Yes</p>
              <p className="pitch-display text-3xl text-[var(--pitch-mint)]">62¢</p>
            </div>
            <div>
              <p className="text-[var(--pitch-fog)]/45">No</p>
              <p className="pitch-display text-3xl text-[var(--pitch-fog)]">38¢</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[var(--pitch-fog)]/45">Vol</p>
              <p className="pitch-display text-xl">$184K</p>
            </div>
          </div>
          <div className="mt-8 space-y-2">
            {[88, 64, 42, 28].map((w, i) => (
              <div key={w} className="flex items-center gap-2">
                <div
                  className="h-2 rounded-sm bg-[var(--pitch-mint)]/80"
                  style={{ width: `${w}%`, opacity: 1 - i * 0.15 }}
                />
                <span className="text-[10px] text-[var(--pitch-fog)]/40">depth</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function OrderBookSlide() {
  const bids = [
    { px: 61, size: 120 },
    { px: 59, size: 85 },
    { px: 57, size: 60 },
    { px: 55, size: 40 },
  ];
  const asks = [
    { px: 63, size: 110 },
    { px: 65, size: 78 },
    { px: 67, size: 52 },
    { px: 69, size: 36 },
  ];
  return (
    <SlideShell kicker="Liquidity" title="Order books explained">
      <p className="max-w-2xl text-sm leading-relaxed text-[var(--pitch-fog)]/75">
        Every market exposes Yes/No bid and ask ladders. Mid price is implied
        probability; spread is the cost of immediacy; stacked size at each level is
        depth — how much you can trade before moving the market.
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--pitch-mint)]">
            Yes bids
          </p>
          <ul className="mt-3 space-y-2">
            {bids.map((lvl) => (
              <li key={lvl.px} className="relative flex items-center justify-between py-1.5 text-sm">
                <span
                  className="absolute inset-y-0 left-0 bg-[var(--pitch-mint)]/20"
                  style={{ width: `${(lvl.size / 120) * 100}%` }}
                />
                <span className="relative font-semibold">{lvl.px}¢</span>
                <span className="relative text-[var(--pitch-fog)]/60">{lvl.size} sh</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--pitch-gold)]">
            Yes asks
          </p>
          <ul className="mt-3 space-y-2">
            {asks.map((lvl) => (
              <li key={lvl.px} className="relative flex items-center justify-between py-1.5 text-sm">
                <span
                  className="absolute inset-y-0 left-0 bg-[var(--pitch-gold)]/20"
                  style={{ width: `${(lvl.size / 120) * 100}%` }}
                />
                <span className="relative font-semibold">{lvl.px}¢</span>
                <span className="relative text-[var(--pitch-fog)]/60">{lvl.size} sh</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-8 text-sm text-[var(--pitch-fog)]/60">
        Tight spreads + deep size = better trader experience and stickier Peakpoints
        velocity. Peaksees aggregates trade levels and fills the ladder so depth is
        always visible in-card.
      </p>
    </SlideShell>
  );
}

function PeakpointsSlide() {
  return (
    <SlideShell kicker="Economy" title="Peakpoints system">
      <div className="grid gap-8 lg:grid-cols-3">
        {[
          {
            title: "Fund",
            body: "Stripe top-ups credit Peakpoints after a 10% platform fee — wallet balance becomes tradeable stake.",
          },
          {
            title: "Trade",
            body: "Buying Yes/No locks Peakpoints in escrow until the market resolves. Prices are 1–99¢ implied odds.",
          },
          {
            title: "Settle",
            body: "Winners release escrow to balances (typically within 72h of close). Losers forfeit held stake.",
          },
        ].map((item) => (
          <div key={item.title} className="border-t border-[var(--pitch-line)] pt-5">
            <p className="pitch-display text-2xl text-[var(--pitch-mint)]">{item.title}</p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--pitch-fog)]/70">{item.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 max-w-2xl text-sm leading-relaxed text-[var(--pitch-fog)]/60">
        Peakpoints is the unit of conviction on peaksees — deposits, open positions,
        rewards, and withdrawals all flow through a single ledger so every opinion
        has a balance sheet.
      </p>
    </SlideShell>
  );
}

function WithdrawalsSlide() {
  return (
    <SlideShell kicker="Cash out" title="Withdrawals">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5 text-sm leading-relaxed text-[var(--pitch-fog)]/75">
          <p>
            Users withdraw Peakpoints to estimated USD payout after a 10% platform
            fee. Requests move through pending → processing → paid, with the ledger
            debited atomically when the withdrawal is created.
          </p>
          <p>
            Escrow held in open markets is not withdrawable until settlement —
            protecting counterparties and keeping the book solvent.
          </p>
          <p className="text-[var(--pitch-fog)]/55">
            Example: withdraw $50.00 Peakpoints → ~$45.00 estimated outbound cash.
          </p>
        </div>
        <div className="border border-[var(--pitch-line)] bg-[var(--pitch-panel)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--pitch-gold)]">
            Lifecycle
          </p>
          <ol className="mt-4 space-y-4">
            {["Request", "Ledger debit", "Processing", "Paid"].map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="pitch-display flex h-8 w-8 items-center justify-center text-sm text-[var(--pitch-mint)]">
                  {i + 1}
                </span>
                <span className="font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </SlideShell>
  );
}

function FundingSlide() {
  return (
    <SlideShell kicker="Capital path" title="Pre-seed → Series M" wide>
      <p className="max-w-2xl text-sm text-[var(--pitch-fog)]/70">
        Modeled raise ladder from product proof through category ownership. Near-term
        ask is pre-seed at {PRESEED_ASK.amount} for {PRESEED_ASK.runway}.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {FUNDING_ROUNDS.map((r) => (
          <div
            key={r.round}
            className={
              "border-t pt-3 " +
              (r.round === "Pre-seed"
                ? "border-[var(--pitch-mint)]"
                : "border-[var(--pitch-line)]")
            }
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--pitch-fog)]/45">
              {r.round}
            </p>
            <p className="pitch-display mt-1 text-xl font-semibold text-[var(--pitch-fog)]">
              {r.amount}
            </p>
            <p className="mt-2 text-[11px] leading-snug text-[var(--pitch-fog)]/55">
              {r.focus}
            </p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function AllocationSlide() {
  return (
    <SlideShell kicker="Use of funds" title="Capital → growth">
      <p className="max-w-2xl text-sm text-[var(--pitch-fog)]/70">
        {PRESEED_ASK.use} Allocation weights stay growth-first across later rounds.
      </p>
      <ul className="mt-8 space-y-4">
        {GROWTH_ALLOCATION.map((row) => (
          <li key={row.bucket}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold sm:text-base">{row.bucket}</p>
              <p className="pitch-display text-lg text-[var(--pitch-mint)]">{row.pct}%</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden bg-white/5">
              <div
                className="pitch-bar-x h-full bg-gradient-to-r from-[var(--pitch-mint-deep)] to-[var(--pitch-mint)]"
                style={{ width: `${row.pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--pitch-fog)]/50">{row.detail}</p>
          </li>
        ))}
      </ul>
    </SlideShell>
  );
}

function CloseSlide() {
  return (
    <div className="pitch-enter mx-auto flex h-full w-full max-w-5xl flex-col justify-center px-5 py-16 sm:px-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--pitch-gold)]">
        The ask
      </p>
      <h2 className="pitch-display mt-4 text-4xl font-semibold leading-[1.05] sm:text-6xl">
        {PRESEED_ASK.amount} pre-seed
      </h2>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--pitch-fog)]/75">
        Build the feed where conviction is liquid — Peak AI stocking every scroll,
        depth on every card, Peakpoints that settle cleanly, and a growth engine
        from signal to stake.
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link
          href="/signup"
          className="bg-[var(--pitch-mint)] px-6 py-3 text-sm font-semibold text-[var(--pitch-ink)] transition hover:brightness-110"
        >
          Join peaksees
        </Link>
        <Link
          href="/feed"
          className="border border-[var(--pitch-line)] px-6 py-3 text-sm font-semibold text-[var(--pitch-fog)] transition hover:bg-white/5"
        >
          Open the feed
        </Link>
      </div>
    </div>
  );
}

const SLIDES = [
  { id: "hero", label: "Motto", render: () => <HeroSlide /> },
  { id: "tam", label: "TAM", render: () => <TamSlide /> },
  { id: "mau", label: "MAU", render: () => <MauSlide /> },
  { id: "funnel", label: "Funnel", render: () => <FunnelSlide /> },
  { id: "peak-ai", label: "Peak AI", render: () => <PeakAiSlide /> },
  { id: "depth", label: "Depth", render: () => <DepthCardsSlide /> },
  { id: "books", label: "Books", render: () => <OrderBookSlide /> },
  { id: "points", label: "Points", render: () => <PeakpointsSlide /> },
  { id: "withdraw", label: "Cash out", render: () => <WithdrawalsSlide /> },
  { id: "funding", label: "Funding", render: () => <FundingSlide /> },
  { id: "alloc", label: "Growth $", render: () => <AllocationSlide /> },
  { id: "close", label: "Ask", render: () => <CloseSlide /> },
] as const;

const SLIDE_COUNT = SLIDES.length;

export function PitchDeck() {
  const [index, setIndex] = useState(0);

  const go = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(SLIDE_COUNT - 1, next)));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, [contenteditable=true]") ||
          (target.tagName === "BUTTON" && target.getAttribute("role") === "option"))
      ) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        setIndex((i) => Math.min(SLIDE_COUNT - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIndex(SLIDE_COUNT - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const slide = SLIDES[index]!;

  return (
    <div className="pitch-root relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pitch-atmosphere pointer-events-none absolute inset-0" aria-hidden />
      <div className="pitch-grid pointer-events-none absolute inset-0 opacity-80" aria-hidden />

      <header className="relative z-20 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--pitch-fog)]/70 transition hover:text-[var(--pitch-fog)]"
        >
          peaksees
        </Link>
        <p className="hidden text-[11px] text-[var(--pitch-fog)]/45 sm:block">
          {slide.label} · {index + 1}/{SLIDE_COUNT}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="border border-[var(--pitch-line)] px-3 py-1.5 text-xs font-semibold disabled:opacity-30"
            aria-label="Previous slide"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === SLIDE_COUNT - 1}
            className="bg-[var(--pitch-mint)] px-3 py-1.5 text-xs font-semibold text-[var(--pitch-ink)] disabled:opacity-30"
            aria-label="Next slide"
          >
            Next
          </button>
        </div>
      </header>

      <main
        className="relative z-10 min-h-0 flex-1"
        key={slide.id}
        aria-live="polite"
        aria-label={`Slide ${index + 1}: ${slide.label}`}
      >
        {slide.render()}
      </main>

      <nav
        aria-label="Slide navigation"
        className="relative z-20 flex items-center justify-center gap-1.5 px-4 pb-4 pt-2"
      >
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to ${s.label}`}
            aria-current={i === index ? "true" : undefined}
            onClick={() => go(i)}
            className={
              "h-1.5 rounded-full transition-all " +
              (i === index
                ? "w-6 bg-[var(--pitch-mint)]"
                : "w-1.5 bg-[var(--pitch-fog)]/25 hover:bg-[var(--pitch-fog)]/50")
            }
          />
        ))}
      </nav>
    </div>
  );
}
