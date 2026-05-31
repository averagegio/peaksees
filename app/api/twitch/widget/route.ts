import { NextResponse } from "next/server";

import { normalizeMarketId } from "@/lib/markets/id";
import { getMarketById } from "@/lib/markets/store";
import {
  marketToTwitchWidgetPayload,
  resolveTwitchWidgetMarket,
} from "@/lib/twitch/widget-payload";

export const runtime = "nodejs";

/** Live Twitch overlay data — public, poll every ~10s from embed. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const channel = url.searchParams.get("channel")?.trim() ?? "";
  const marketParam = url.searchParams.get("market")?.trim() ?? "";

  const resolved = await resolveTwitchWidgetMarket({
    channel: channel || undefined,
    marketId: marketParam ? normalizeMarketId(marketParam) : undefined,
  });

  if (!resolved) {
    return NextResponse.json(
      {
        error:
          "No market for this channel. Pin a market via POST /api/twitch/pin or pass ?market=id.",
      },
      { status: 404 },
    );
  }

  const market = await getMarketById(resolved.marketId);
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const payload = marketToTwitchWidgetPayload(market, { channel: resolved.channel });

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=8, s-maxage=15",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
