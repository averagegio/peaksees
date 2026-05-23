import type { MarketPost } from "@/app/lib/mock-markets";
import type { Market } from "@/lib/markets/store";
import type { Peak } from "@/lib/peaks/store";

export function formatMarketPostedAt(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "Just now";
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}m ago`;
  if (ms < 86_400_000) return `${Math.max(1, Math.floor(ms / 3_600_000))}h ago`;
  return "Today";
}

export function marketAndPeakToPost(
  market: Market,
  peak: Peak,
  opts?: { pending?: boolean; postedAt?: string },
): MarketPost {
  const yesP = Number(market.yesProbability) || 0.5;
  const noP = Number(market.noProbability) || 1 - yesP;
  const isPending = opts?.pending ?? market.id.startsWith("pending:");
  return {
    id: market.id.startsWith("market:") ? market.id.slice("market:".length) : market.id,
    creator: peak.displayName,
    handle: peak.handle,
    avatarHue: peak.avatarHue,
    postedAt:
      opts?.postedAt ?? (isPending ? "Just now" : formatMarketPostedAt(market.createdAt)),
    question: market.question,
    category: market.category,
    subcategory: market.subcategory || undefined,
    hashtags: Array.isArray(market.hashtags) && market.hashtags.length ? market.hashtags : undefined,
    volumeUsd: Math.round((market.volumeCents ?? 0) / 100),
    endsAtLabel: market.endsAt,
    pending: isPending,
    profileUserId: peak.userId,
    marketSource: market.source,
    outcomes: [
      { id: "y", label: "Yes", probability: yesP },
      { id: "n", label: "No", probability: noP },
    ],
  };
}

export function marketToPost(market: Market, peak?: Peak | null): MarketPost {
  if (peak) return marketAndPeakToPost(market, peak);
  const yesP = Number(market.yesProbability) || 0.5;
  const noP = Number(market.noProbability) || 1 - yesP;
  return {
    id: market.id.startsWith("market:") ? market.id.slice("market:".length) : market.id,
    creator: "Peak AI",
    handle: "@peak",
    avatarHue: 160,
    postedAt: formatMarketPostedAt(market.createdAt),
    question: market.question,
    category: market.category,
    subcategory: market.subcategory || undefined,
    hashtags: Array.isArray(market.hashtags) && market.hashtags.length ? market.hashtags : undefined,
    volumeUsd: Math.round((market.volumeCents ?? 0) / 100),
    endsAtLabel: market.endsAt,
    marketSource: market.source,
    outcomes: [
      { id: "y", label: "Yes", probability: yesP },
      { id: "n", label: "No", probability: noP },
    ],
  };
}

export function buildOptimisticMarket(clientId: string, text: string): Market {
  const trimmed = text.trim().slice(0, 280);
  const question = /[?]$/.test(trimmed)
    ? trimmed
    : `Will this happen: ${trimmed.slice(0, 200)}?`;
  const createdAt = new Date().toISOString();
  return {
    id: `pending:${clientId}`,
    question: question.slice(0, 240),
    category: "Culture",
    subcategory: "",
    hashtags: ["#peak"],
    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedSide: null,
    resolvedAt: null,
    createdAt,
    source: "pending",
    yesProbability: 0.5,
    noProbability: 0.5,
    volumeCents: 0,
  };
}

export function buildOptimisticPeak(
  clientId: string,
  input: {
    text: string;
    expiresAt?: string | null;
    userId: string;
    displayName: string;
    handle: string;
    avatarHue: number;
  },
): Peak {
  return {
    id: `pending:${clientId}`,
    userId: input.userId,
    displayName: input.displayName,
    handle: input.handle,
    avatarHue: input.avatarHue,
    avatarUrl: "",
    text: input.text.trim().slice(0, 280),
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
  };
}

export type ProfilePeakFeedItem = {
  peak: Peak;
  market: Market | null;
  /** When you repeaked this peak (pin saved). */
  repeakedAt?: string | null;
  /** True when this row is someone else's peak you repeaked. */
  isRepeak?: boolean;
};

export function prependProfileFeedItem(
  prev: ProfilePeakFeedItem[],
  item: ProfilePeakFeedItem,
): ProfilePeakFeedItem[] {
  return [item, ...prev.filter((row) => row.peak.id !== item.peak.id)].slice(0, 40);
}

export function replacePendingProfileFeedItem(
  prev: ProfilePeakFeedItem[],
  clientId: string,
  item: ProfilePeakFeedItem,
): ProfilePeakFeedItem[] {
  const filtered = prev.filter((row) => row.peak.id !== `pending:${clientId}`);
  return prependProfileFeedItem(filtered, item);
}

export function dropPendingProfileFeedItem(
  prev: ProfilePeakFeedItem[],
  clientId: string,
): ProfilePeakFeedItem[] {
  return prev.filter((row) => row.peak.id !== `pending:${clientId}`);
}
