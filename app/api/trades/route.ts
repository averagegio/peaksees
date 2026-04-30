import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { buyMarketSide } from "@/lib/markets/trade";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { marketId?: string; side?: string; amountCents?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const marketId = typeof body.marketId === "string" ? body.marketId : "";
  const side = body.side === "yes" || body.side === "no" ? body.side : "";
  const amountCents = Math.floor(Number(body.amountCents ?? 0));

  if (!marketId || !side) {
    return NextResponse.json({ error: "marketId and side are required" }, { status: 400 });
  }
  if (!Number.isFinite(amountCents) || amountCents < 100) {
    return NextResponse.json({ error: "amountCents must be >= 100" }, { status: 400 });
  }

  try {
    const { trade } = await buyMarketSide({
      userId: session.user.id,
      marketId,
      side: side as "yes" | "no",
      amountCents,
    });
    return NextResponse.json({ ok: true, trade });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not place trade";
    if (msg.toLowerCase().includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.toLowerCase().includes("insufficient") || msg.toLowerCase().includes("amountcents")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

