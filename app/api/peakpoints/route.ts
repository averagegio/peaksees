import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { addLedgerEntry, getBalanceCents, listLedger } from "@/lib/peakpoints/ledger";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const balanceCents = await getBalanceCents(session.user.id);
  const ledger = await listLedger(session.user.id);
  return NextResponse.json({ balanceCents, ledger });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string; amountCents?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const amountCents = Math.floor(Number(body.amountCents ?? 0));
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "amountCents must be > 0" }, { status: 400 });
  }

  if (action === "deposit") {
    // Stub deposit: in production wire this to Stripe/checkout webhook.
    await addLedgerEntry({
      userId: session.user.id,
      kind: "deposit",
      amountCents,
      note: "Stub deposit (wire payment provider to make real).",
    });
  } else if (action === "withdraw") {
    const bal = await getBalanceCents(session.user.id);
    if (bal < amountCents) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }
    await addLedgerEntry({
      userId: session.user.id,
      kind: "withdraw",
      amountCents: -amountCents,
      note: "Stub withdraw (wire payout provider to make real).",
    });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const balanceCents = await getBalanceCents(session.user.id);
  const ledger = await listLedger(session.user.id);
  return NextResponse.json({ balanceCents, ledger });
}

