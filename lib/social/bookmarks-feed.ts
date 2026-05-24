import "server-only";

import { marketToPost } from "@/app/lib/peak-market";
import type { MarketPost } from "@/app/lib/mock-markets";
import {
  getMarketById,
  listMarketsByPeakIds,
  peakIdFromMarketSource,
} from "@/lib/markets/store";
import type { Market } from "@/lib/markets/store";
import { getPeakById } from "@/lib/peaks/store";
import type { Peak } from "@/lib/peaks/store";
import { listPinEntries } from "@/lib/social/pins-store";

export type BookmarkMarketRow = {
  type: "market";
  postKey: string;
  savedAt: string;
  post: MarketPost;
};

export type BookmarkPeakRow = {
  type: "peak";
  postKey: string;
  savedAt: string;
  peak: Peak;
  market: Market | null;
};

export type BookmarkRow = BookmarkMarketRow | BookmarkPeakRow;

function parseMarketPinId(postKey: string): string | null {
  if (!postKey.startsWith("market:")) return null;
  const id = postKey.slice("market:".length).trim();
  return id.length > 0 ? id : null;
}

function parsePeakPinId(postKey: string): string | null {
  if (!postKey.startsWith("peak:")) return null;
  const id = postKey.slice("peak:".length).trim();
  return id.length > 0 ? id : null;
}

/** Resolve saved pins into feed-ready rows (newest bookmark first). */
export async function buildBookmarkRows(userId: string, limit = 60): Promise<BookmarkRow[]> {
  const entries = await listPinEntries(userId, limit);
  const rows: BookmarkRow[] = [];

  for (const entry of entries) {
    const marketId = parseMarketPinId(entry.postKey);
    if (marketId) {
      const market = await getMarketById(marketId);
      if (!market) continue;
      const peakId = peakIdFromMarketSource(market.source);
      const peak = peakId ? await getPeakById(peakId) : null;
      rows.push({
        type: "market",
        postKey: entry.postKey,
        savedAt: entry.createdAt,
        post: marketToPost(market, peak),
      });
      continue;
    }

    const peakId = parsePeakPinId(entry.postKey);
    if (!peakId) continue;
    const peak = await getPeakById(peakId);
    if (!peak) continue;
    const marketByPeak = await listMarketsByPeakIds([peakId]);
    rows.push({
      type: "peak",
      postKey: entry.postKey,
      savedAt: entry.createdAt,
      peak,
      market: marketByPeak.get(peakId) ?? null,
    });
  }

  return rows;
}
