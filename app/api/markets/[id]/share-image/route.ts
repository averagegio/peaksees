import { NextResponse } from "next/server";

import { appBaseUrl } from "@/lib/app-url";
import { marketOgImageResponse } from "@/lib/markets/market-og-image";
import { getMarketById } from "@/lib/markets/store";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/** OG / X link preview image — always the designed 1200×630 card (not a feed DOM capture). */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const marketId = decodeURIComponent(id ?? "").trim();
  if (!marketId) {
    return NextResponse.json({ error: "Missing market id" }, { status: 400 });
  }

  const market = await getMarketById(marketId);
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  let siteHost = "peaksees.com";
  try {
    siteHost = new URL(appBaseUrl()).hostname;
  } catch {
    // keep default
  }

  const res = marketOgImageResponse(market, siteHost);
  res.headers.set(
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );
  return res;
}
