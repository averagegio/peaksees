import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { getBalanceCents, listLedger } from "@/lib/peakpoints/ledger";
import { getStripe } from "@/lib/stripe/server";
import { fulfillWalletTopupCheckout } from "@/lib/stripe/wallet-topup";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { sessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Stripe is not configured" },
      { status: 500 },
    );
  }

  let checkout;
  try {
    checkout = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
  }

  const ownerId = String(checkout.metadata?.userId ?? "").trim();
  if (ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await fulfillWalletTopupCheckout(checkout);
  const balanceCents = await getBalanceCents(session.user.id);
  const ledger = await listLedger(session.user.id);

  return NextResponse.json({
    ...result,
    balanceCents,
    ledger,
  });
}
