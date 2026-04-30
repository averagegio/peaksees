import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { listMarkets } from "@/lib/markets/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.floor(Number(url.searchParams.get("limit") ?? "50"));
  const markets = await listMarkets({ limit: Number.isFinite(limit) ? limit : 50 });
  return NextResponse.json({ markets });
}

