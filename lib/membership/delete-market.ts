import "server-only";

import { getPeakById } from "@/lib/peaks/store";
import { getUserById } from "@/lib/auth/users-store";
import { hasPeakPlusTier } from "@/lib/membership/plans";
import {
  deleteMarketById,
  getMarketById,
  peakIdFromMarketSource,
} from "@/lib/markets/store";

export async function deleteOwnedUserMarket(input: {
  marketId: string;
  userId: string;
}): Promise<{ ok: true } | { error: string; status: number }> {
  const market = await getMarketById(input.marketId);
  if (!market) return { error: "Market not found", status: 404 };

  const peakId = peakIdFromMarketSource(market.source);
  if (!peakId) {
    return { error: "Only user-created markets can be deleted", status: 403 };
  }

  const peak = await getPeakById(peakId);
  if (!peak || peak.userId !== input.userId) {
    return { error: "You can only delete your own markets", status: 403 };
  }

  const owner = await getUserById(input.userId);
  if (!owner || !hasPeakPlusTier(owner.memberPlan)) {
    return { error: "PeakPlus required to delete your markets", status: 403 };
  }

  if (market.resolvedSide) {
    return { error: "Resolved markets cannot be deleted", status: 409 };
  }

  if (market.volumeCents > 0) {
    return { error: "Markets with trades cannot be deleted", status: 409 };
  }

  const deleted = await deleteMarketById(market.id);
  if (!deleted) return { error: "Market not found", status: 404 };
  return { ok: true };
}
