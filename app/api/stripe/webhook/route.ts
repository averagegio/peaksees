import { NextResponse } from "next/server";
import Stripe from "stripe";

import { addLedgerEntry } from "@/lib/peakpoints/ledger";
import { getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripe();
  const sig = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 },
    );
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bad signature" },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const kind = String(session.metadata?.kind ?? "");
    const userId = String(session.metadata?.userId ?? "");

    if (kind === "wallet_topup" && userId) {
      const amount = session.amount_total ?? 0;
      if (amount > 0) {
        await addLedgerEntry({
          userId,
          kind: "deposit",
          amountCents: amount,
          note: "Stripe wallet top-up",
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}

