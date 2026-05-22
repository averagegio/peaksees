import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { createPeak, getPeakById, listPeaks } from "@/lib/peaks/store";
import { generateMarketFromPeak } from "@/lib/markets/generate";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const mine = url.searchParams.get("mine") === "1";
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const highlight = url.searchParams.get("highlight")?.trim() ?? "";
  const capped = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, limitRaw)) : 20;

  let peaks = await listPeaks({
    mineUserId: mine ? session.user.id : undefined,
    limit: capped,
  });

  if (highlight) {
    const hp = await getPeakById(highlight);
    if (hp) {
      peaks = [hp, ...peaks.filter((p) => p.id !== hp.id)].slice(0, capped);
    }
  }

  return NextResponse.json({ peaks });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { text?: string; expiresAt?: string | null; createMarket?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  if (text.trim().length < 1) {
    return NextResponse.json({ error: "Post text required" }, { status: 400 });
  }

  const expiresAt =
    typeof body.expiresAt === "string" && body.expiresAt.trim()
      ? body.expiresAt
      : null;
  const createMarket = body.createMarket === true;
  const peak = await createPeak({ userId: session.user.id, text, expiresAt });
  const market = createMarket
    ? await generateMarketFromPeak({ peakId: peak.id, text: peak.text })
    : null;
  return NextResponse.json({ peak, market });
}
