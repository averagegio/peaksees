import { NextResponse } from "next/server";

import { normalizeMarketId } from "@/lib/markets/id";
import { getMarketOrderbook } from "@/lib/markets/market-orderbook";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Live spread and order book levels for a market (mobile long-press). */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const marketId = normalizeMarketId(decodeURIComponent(id ?? "").trim());
  if (!marketId) {
    return NextResponse.json({ error: "Missing market id" }, { status: 400 });
  }

  const book = await getMarketOrderbook(marketId);
  if (!book) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  return NextResponse.json(book, {
    headers: { "Cache-Control": "public, max-age=15, s-maxage=30" },
  });
}
