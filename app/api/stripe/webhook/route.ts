import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  PLATFORM_FEE_RATE,
  peakpointsCreditAfterDepositFee,
} from "@/lib/peakpoints/fees";
import { tryCreditWalletTopupOnce } from "@/lib/peakpoints/ledger";
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
    const userId = String(session.metadata?.userId ?? "").trim();

    if (kind === "wallet_topup" && userId && session.mode === "payment") {
      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true });
      }
      const checkoutId = String(session.id ?? "").trim();
      if (!checkoutId) {
        return NextResponse.json({ received: true });
      }
      const grossPaid = session.amount_total ?? 0;
      const credited = peakpointsCreditAfterDepositFee(grossPaid);
      if (credited > 0) {
        await tryCreditWalletTopupOnce({
          checkoutSessionId: checkoutId,
          userId,
          creditedCents: credited,
          note: `Stripe wallet top-up (credit after ${Math.round(PLATFORM_FEE_RATE * 100)}% deposit fee on $${(grossPaid / 100).toFixed(2)} paid)`,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}

