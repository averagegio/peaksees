import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { normalizeMarketId } from "@/lib/markets/id";
import { getMarketById } from "@/lib/markets/store";
import {
  marketToTwitchWidgetPayload,
  resolveTwitchWidgetMarket,
} from "@/lib/twitch/widget-payload";
import { pinMarketToTwitchChannel } from "@/lib/twitch/store";

export const runtime = "nodejs";

/** Pin the active market for a Twitch channel (stream overlay + panel). */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { channelLogin?: string; marketId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const channelLogin = typeof body.channelLogin === "string" ? body.channelLogin : "";
  const marketId = normalizeMarketId(typeof body.marketId === "string" ? body.marketId : "");
  if (!channelLogin || !marketId) {
    return NextResponse.json(
      { error: "channelLogin and marketId are required" },
      { status: 400 },
    );
  }

  const market = await getMarketById(marketId);
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  try {
    const pin = await pinMarketToTwitchChannel({
      channelLogin,
      marketId,
      userId: session.user.id,
    });
    const payload = marketToTwitchWidgetPayload(market, { channel: pin.channelLogin });
    return NextResponse.json({ ok: true, pin, widget: payload });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not pin market";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** Read pinned market for a channel (auth optional). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const channel = url.searchParams.get("channel")?.trim() ?? "";
  const resolved = await resolveTwitchWidgetMarket({ channel: channel || undefined });
  if (!resolved) {
    return NextResponse.json({ pin: null, widget: null });
  }
  const market = await getMarketById(resolved.marketId);
  if (!market) {
    return NextResponse.json({ pin: null, widget: null });
  }
  return NextResponse.json({
    pin: { channel: resolved.channel, marketId: resolved.marketId },
    widget: marketToTwitchWidgetPayload(market, { channel: resolved.channel }),
  });
}
