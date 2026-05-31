import { NextResponse } from "next/server";

import { normalizeMarketId } from "@/lib/markets/id";
import { getMarketById } from "@/lib/markets/store";
import { isMarketTradingOpen } from "@/lib/markets/market-status";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Public market summary for embeds, Twitch widget, and third-party polls. */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const marketId = normalizeMarketId(decodeURIComponent(id ?? "").trim());
  if (!marketId) {
    return NextResponse.json({ error: "Missing market id" }, { status: 400 });
  }

  const market = await getMarketById(marketId);
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const yesP = Number(market.yesProbability) || 0.5;
  const noP = Number(market.noProbability) || 1 - yesP;

  return NextResponse.json(
    {
      id: market.id,
      question: market.question,
      category: market.category,
      subcategory: market.subcategory,
      hashtags: market.hashtags,
      yesProbability: yesP,
      noProbability: noP,
      yesPriceCents: Math.min(99, Math.max(1, Math.round(yesP * 100))),
      noPriceCents: Math.min(99, Math.max(1, Math.round(noP * 100))),
      volumeCents: market.volumeCents,
      endsAt: market.endsAt,
      resolvedSide: market.resolvedSide,
      resolvedAt: market.resolvedAt,
      createdAt: market.createdAt,
      source: market.source,
      tradingOpen: isMarketTradingOpen({
        endsAt: market.endsAt,
        resolvedSide: market.resolvedSide,
      }),
    },
    { headers: { "Cache-Control": "public, max-age=10, s-maxage=30" } },
  );
}
