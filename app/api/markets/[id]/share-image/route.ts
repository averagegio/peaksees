import { NextResponse } from "next/server";

import { appBaseUrl } from "@/lib/app-url";
import { getSession } from "@/lib/auth/session";
import { marketOgImageResponse } from "@/lib/markets/market-og-image";
import { getMarketShareImage, upsertMarketShareImage } from "@/lib/markets/share-image-store";
import { getMarketById } from "@/lib/markets/store";

export const runtime = "nodejs";

const MAX_BYTES = 2_500_000;

type RouteContext = { params: Promise<{ id: string }> };

/** OG / X preview — uploaded card snapshot when available, else generated fallback. */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const marketId = decodeURIComponent(id ?? "").trim();
  if (!marketId) {
    return NextResponse.json({ error: "Missing market id" }, { status: 400 });
  }

  const stored = await getMarketShareImage(marketId);
  if (stored) {
    return new NextResponse(new Uint8Array(stored), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
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

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const marketId = decodeURIComponent(id ?? "").trim();
  if (!marketId) {
    return NextResponse.json({ error: "Missing market id" }, { status: 400 });
  }

  const market = await getMarketById(marketId);
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("image/png")) {
    return NextResponse.json({ error: "Expected image/png body" }, { status: 415 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (!bytes.length) {
    return NextResponse.json({ error: "Empty image" }, { status: 400 });
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  await upsertMarketShareImage(marketId, bytes);
  return NextResponse.json({ ok: true });
}
