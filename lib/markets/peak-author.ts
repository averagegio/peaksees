import "server-only";

import { getUserById } from "@/lib/auth/users-store";
import { formatAtHandle } from "@/lib/auth/handle";
import { getPeakById } from "@/lib/peaks/store";
import type { Market } from "@/lib/markets/store";
import { peakIdFromMarketSource } from "@/lib/markets/store";
import type { MemberPlan } from "@/lib/membership/plans";

export type MarketPeakAuthor = {
  userId: string;
  displayName: string;
  handle: string;
  avatarHue: number;
  memberPlan: MemberPlan;
};

function hueForUserId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

export async function getMarketPeakAuthor(
  market: Market,
): Promise<MarketPeakAuthor | null> {
  const peakId = peakIdFromMarketSource(market.source);
  if (!peakId) return null;
  const peak = await getPeakById(peakId);
  if (!peak) return null;
  const user = await getUserById(peak.userId);
  return {
    userId: peak.userId,
    displayName: peak.displayName,
    handle: peak.handle,
    avatarHue: peak.avatarHue,
    memberPlan: user?.memberPlan ?? "free",
  };
}

export async function enrichMarketsWithPeakAuthors(
  markets: Market[],
): Promise<Map<string, MarketPeakAuthor>> {
  const out = new Map<string, MarketPeakAuthor>();
  await Promise.all(
    markets.map(async (m) => {
      const author = await getMarketPeakAuthor(m);
      if (author) out.set(m.id, author);
    }),
  );
  return out;
}

export { hueForUserId };
