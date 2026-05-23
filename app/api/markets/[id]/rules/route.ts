import { NextResponse } from "next/server";

import { marketContractPageUrl } from "@/lib/app-url";
import { buildMarketContract } from "@/lib/markets/market-contract";
import { normalizeMarketId } from "@/lib/markets/id";
import { getMarketById } from "@/lib/markets/store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** Market rules + contract link + payout timeline for a generated market card. */
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

  const contract = buildMarketContract(market, marketContractPageUrl(market.id));
  return NextResponse.json(contract, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
  });
}
