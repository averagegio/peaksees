import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { listMarkets, type MarketCursor } from "@/lib/markets/store";
import { feedAutogenMinIntervalMs, maybeGenerateMarketsOnRefresh } from "@/lib/markets/generate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.floor(Number(url.searchParams.get("limit") ?? "50"));
  const autogen = url.searchParams.get("autogen") === "1";
  const count = Math.floor(Number(url.searchParams.get("count") ?? "4"));
  let category = (url.searchParams.get("category") ?? "").trim();
  let subcategory = (url.searchParams.get("subcategory") ?? "").trim();
  // Legacy clients sent subcategory=anime; DB uses category=Anime + subcats like manga/releases.
  if (subcategory.toLowerCase() === "anime" && !category) {
    category = "Anime";
    subcategory = "";
  }
  const tz = (url.searchParams.get("tz") ?? "").trim();
  const cursorCreatedAt = (url.searchParams.get("cursorCreatedAt") ?? "").trim();
  const cursorId = (url.searchParams.get("cursorId") ?? "").trim();
  const cursor: MarketCursor | undefined =
    cursorCreatedAt && cursorId ? { createdAt: cursorCreatedAt, id: cursorId } : undefined;

  if (autogen && !cursor) {
    // Run generation in the background so the feed returns immediately.
    void maybeGenerateMarketsOnRefresh({
      count,
      minIntervalMs: feedAutogenMinIntervalMs(),
      dailyCap: 120,
      category: category || undefined,
      subcategory: subcategory || undefined,
      tz: tz || undefined,
    }).catch(() => {});
  }
  const markets = await listMarkets({
    limit: Number.isFinite(limit) ? limit : 50,
    category: category || undefined,
    subcategory: subcategory || undefined,
    cursor,
  });
  return NextResponse.json({ markets });
}

