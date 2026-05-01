import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { resolveAndSettleMarket } from "@/lib/markets/settle";

export const runtime = "nodejs";

async function isAdmin(request: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth === `Bearer ${secret}`) return true;

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length === 0) return false;

  const session = await getSession();
  const email = session?.user.email?.toLowerCase?.() ?? "";
  return Boolean(email && adminEmails.includes(email));
}

export async function POST(request: Request) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { marketId?: string; outcome?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const marketId = typeof body.marketId === "string" ? body.marketId.trim() : "";
  const outcome = body.outcome === "yes" || body.outcome === "no" ? body.outcome : "";
  if (!marketId || !outcome) {
    return NextResponse.json(
      { error: "marketId and outcome (yes|no) required" },
      { status: 400 },
    );
  }

  try {
    const result = await resolveAndSettleMarket({
      marketId,
      outcome: outcome as "yes" | "no",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to resolve market";
    const lower = msg.toLowerCase();
    if (lower.includes("not found")) return NextResponse.json({ error: msg }, { status: 404 });
    if (lower.includes("already")) return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

