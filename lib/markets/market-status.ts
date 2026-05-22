import type { MarketSide } from "@/lib/markets/store";

/** Parse ISO `ends_at`; returns null when not a valid date string. */
export function parseMarketEndsAtMs(endsAt: string): number | null {
  const ms = Date.parse(endsAt.trim());
  return Number.isFinite(ms) ? ms : null;
}

export function isMarketExpired(endsAt: string, nowMs = Date.now()): boolean {
  const endsMs = parseMarketEndsAtMs(endsAt);
  if (endsMs === null) return false;
  return endsMs <= nowMs;
}

export function isMarketTradingOpen(input: {
  endsAt: string;
  resolvedSide: MarketSide | null;
  nowMs?: number;
}): boolean {
  if (input.resolvedSide) return false;
  return !isMarketExpired(input.endsAt, input.nowMs);
}

export function marketClosedReason(input: {
  endsAt: string;
  resolvedSide: MarketSide | null;
}): string | null {
  if (input.resolvedSide) return "Market already resolved";
  if (isMarketExpired(input.endsAt)) return "Market has ended";
  return null;
}
