import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import {
  PLATFORM_FEE_RATE,
  peakpointsCreditAfterDepositFee,
  payoutCentsAfterWithdrawFee,
} from "@/lib/peakpoints/fees";
import { addLedgerEntry, getBalanceCents, listLedger } from "@/lib/peakpoints/ledger";

export const runtime = "nodejs";

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
    if (process.env.ALLOW_STUB_PEAKPOINTS_DEPOSIT !== "true") {
      return NextResponse.json(
        {
          error:
            "Free-text deposits are disabled. Add money from the Peakpoints page via Stripe Checkout.",
        },
        { status: 403 },
      );
    }
    const credited = peakpointsCreditAfterDepositFee(amountCents);
    if (credited <= 0) {
      return NextResponse.json({ error: "Amount too small after fee" }, { status: 400 });
    }
    await addLedgerEntry({
      userId: session.user.id,
      kind: "deposit",
      amountCents: credited,
      note: `Stub deposit (${Math.round(PLATFORM_FEE_RATE * 100)}% deposit fee applied to gross ${amountCents}c).`,
    });
  } else if (action === "withdraw") {
    const bal = await getBalanceCents(session.user.id);
    if (bal < amountCents) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }
    const payoutCents = payoutCentsAfterWithdrawFee(amountCents);
    await addLedgerEntry({
      userId: session.user.id,
      kind: "withdraw",
      amountCents: -amountCents,
      note: `Withdrawal (${Math.round(PLATFORM_FEE_RATE * 100)}% fee); estimated payout ${payoutCents}c (stub — connect payout provider).`,
    });
    const balanceCents = await getBalanceCents(session.user.id);
    const ledger = await listLedger(session.user.id);
    return NextResponse.json({ balanceCents, ledger, payoutCents });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const balanceCents = await getBalanceCents(session.user.id);
  const ledger = await listLedger(session.user.id);
  return NextResponse.json({ balanceCents, ledger });
}

