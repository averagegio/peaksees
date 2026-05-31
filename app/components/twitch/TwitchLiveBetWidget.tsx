"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MarketTradeBox } from "@/app/components/market/MarketTradeBox";
import { safeJson } from "@/lib/http";

type WidgetPayload = {
  channel: string | null;
  market: {
    id: string;
    question: string;
    category: string;
    yesProbability: number;
    noProbability: number;
    yesPriceCents: number;
    noPriceCents: number;
    volumeCents: number;
    tradingOpen: boolean;
    resolvedSide: string | null;
  };
  links: {
    betUrl: string;
    marketUrl: string;
    overlayEmbedUrl: string;
    panelEmbedUrl: string;
  };
};

export function TwitchLiveBetWidget({
  channel,
  marketId,
  mode = "overlay",
  transparent = false,
}: {
  channel?: string;
  marketId?: string;
  mode?: "overlay" | "panel";
  transparent?: boolean;
}) {
  const [data, setData] = useState<WidgetPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!transparent) return;
    document.documentElement.classList.add("embed-transparent");
    document.body.classList.add("embed-transparent");
    return () => {
      document.documentElement.classList.remove("embed-transparent");
      document.body.classList.remove("embed-transparent");
    };
  }, [transparent]);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (channel) q.set("channel", channel);
      if (marketId) q.set("market", marketId);
      const res = await fetch(`/api/twitch/widget?${q.toString()}`, { cache: "no-store" });
      const json = await safeJson<WidgetPayload & { error?: string }>(res);
      if (!res.ok) {
        setError(json?.error ?? "Could not load market");
        setData(null);
        return;
      }
      setError(null);
      setData(json);
    } catch {
      setError("Network error");
    }
  }, [channel, marketId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 12_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (mode !== "panel") return;
    void (async () => {
      const res = await fetch("/api/me", { cache: "no-store" });
      const json = (await safeJson<{ user?: unknown }>(res)) ?? {};
      setAuthed(Boolean(json.user));
    })();
  }, [mode]);

  const shellClass =
    (transparent ? "bg-transparent " : "bg-zinc-950/90 ") +
    (mode === "overlay"
      ? "min-h-0 w-full max-w-[1920px] px-4 py-3"
      : "min-h-dvh w-full max-w-lg mx-auto px-4 py-6");

  if (error) {
    return (
      <div className={shellClass + " text-sm text-red-400 font-medium"}>{error}</div>
    );
  }

  if (!data) {
    return (
      <div className={shellClass + " text-sm text-zinc-400 animate-pulse"}>
        Loading live market…
      </div>
    );
  }

  const { market, links } = data;
  const yesPct = Math.round(market.yesProbability * 100);
  const noPct = Math.round(market.noProbability * 100);
  const loginNext = encodeURIComponent(`/feed?m=${encodeURIComponent(market.id)}`);

  if (mode === "panel") {
    return (
      <div className={shellClass + " text-zinc-100"}>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
          {data.channel ? (
            <span className="text-xs text-zinc-400">twitch.tv/{data.channel}</span>
          ) : null}
        </div>
        <h1 className="mt-3 text-lg font-bold leading-snug">{market.question}</h1>
        <p className="mt-1 text-xs text-zinc-400">{market.category}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-emerald-300">Yes</p>
            <p className="text-2xl font-extrabold text-emerald-400">{yesPct}%</p>
            <p className="text-[11px] text-emerald-200/80">{market.yesPriceCents}¢</p>
          </div>
          <div className="rounded-xl border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase text-zinc-400">No</p>
            <p className="text-2xl font-extrabold text-zinc-100">{noPct}%</p>
            <p className="text-[11px] text-zinc-400">{market.noPriceCents}¢</p>
          </div>
        </div>

        {market.tradingOpen ? (
          authed ? (
            <div className="mt-4">
              <MarketTradeBox marketId={market.id} yesProbability={market.yesProbability} />
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/login?next=${loginNext}`}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Log in to bet
              </Link>
              <Link
                href={`/signup?next=${loginNext}`}
                className="rounded-xl border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
              >
                Sign up
              </Link>
            </div>
          )
        ) : (
          <p className="mt-4 text-sm text-amber-400">Market closed for trading.</p>
        )}

        <p className="mt-4 text-center text-[11px] text-zinc-500">
          <a href={links.marketUrl} className="underline hover:text-zinc-300">
            View on peaksees
          </a>
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        shellClass +
        " flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 font-sans text-white shadow-lg backdrop-blur-md"
      }
    >
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#9146FF] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
        Live · Bet
      </span>

      <p className="min-w-0 flex-1 text-sm font-semibold leading-snug sm:text-base">
        {market.question}
      </p>

      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-300">
          Yes {yesPct}¢
        </span>
        <span className="rounded-lg bg-zinc-800/80 px-2.5 py-1 text-xs font-bold text-zinc-200">
          No {market.noPriceCents}¢
        </span>
      </div>

      <a
        href={links.betUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-emerald-500"
      >
        Bet now →
      </a>
    </div>
  );
}
