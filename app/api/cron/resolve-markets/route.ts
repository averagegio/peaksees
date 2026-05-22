import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth/admin";
import { determineMarketOutcome } from "@/lib/markets/resolve-outcome";
import { resolveAndSettleMarket } from "@/lib/markets/settle";
import { listMarketsDueForResolution } from "@/lib/markets/store";

export const runtime = "nodejs";

function clampLimit(raw: number) {
  const limit = Math.floor(raw);
  if (!Number.isFinite(limit)) return 10;
  return Math.max(1, Math.min(25, limit));
}

async function runResolveMarkets(limit: number) {
  const due = await listMarketsDueForResolution({ limit });
  const resolved: Array<{ id: string; question: string; outcome: string }> = [];
  const errors: Array<{ id: string; error: string }> = [];

  for (const market of due) {
    try {
      const outcome = await determineMarketOutcome(market);
      const result = await resolveAndSettleMarket({ marketId: market.id, outcome });
      resolved.push({ id: market.id, question: market.question, outcome: result.outcome });
    } catch (e) {
      errors.push({
        id: market.id,
        error: e instanceof Error ? e.message : "Failed to resolve",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: due.length,
    resolvedCount: resolved.length,
    resolved,
    errors,
  });
}

/** Vercel Cron invokes GET with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const limit = clampLimit(Number(url.searchParams.get("limit") ?? 10));
  return runResolveMarkets(limit);
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let limit = 10;
  try {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    if (typeof body.limit === "number") limit = body.limit;
  } catch {
    // ignore
  }
  return runResolveMarkets(clampLimit(limit));
}
