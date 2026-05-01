import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { listMarkets } from "@/lib/markets/store";
import { maybeGenerateMarketsOnRefresh } from "@/lib/markets/generate";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.floor(Number(url.searchParams.get("limit") ?? "50"));
  const autogen = url.searchParams.get("autogen") === "1";
  const count = Math.floor(Number(url.searchParams.get("count") ?? "5"));
  const category = (url.searchParams.get("category") ?? "").trim();
  const subcategory = (url.searchParams.get("subcategory") ?? "").trim();
  const tz = (url.searchParams.get("tz") ?? "").trim();
  const geo = (url.searchParams.get("geo") ?? "").trim();

  if (autogen) {
    // Generate a small batch per refresh, but rate-limit + cap daily total.
    await maybeGenerateMarketsOnRefresh({
      count,
      minIntervalMs: 60_000,
      dailyCap: 100,
      category: category || undefined,
      subcategory: subcategory || undefined,
      tz: tz || undefined,
      geo: geo || undefined,
    });
  }
  const markets = await listMarkets({
    limit: Number.isFinite(limit) ? limit : 50,
    category: category || undefined,
    subcategory: subcategory || undefined,
  });
  return NextResponse.json({ markets });
}

