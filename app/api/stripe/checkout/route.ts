import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { getAppUrl, getStripe } from "@/lib/stripe/server";

export const runtime = "nodejs";

function planToPriceId(plan: string) {
  if (plan === "peakplus") return process.env.STRIPE_PRICE_PEAKPLUS ?? "";
  if (plan === "peakpro") return process.env.STRIPE_PRICE_PEAKPRO ?? "";
  if (plan === "peakenterprise") return process.env.STRIPE_PRICE_PEAKENTERPRISE ?? "";
  return "";
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let kind = "";
  let plan = "";
  let amountCents = 0;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    kind = String(form.get("kind") ?? "");
    plan = String(form.get("plan") ?? "");
    amountCents = Math.floor(Number(form.get("amountCents") ?? 0));
  } else {
    const body = (await request.json().catch(() => ({}))) as {
      kind?: string;
      plan?: string;
      amountCents?: number;
    };
    kind = typeof body.kind === "string" ? body.kind : "";
    plan = typeof body.plan === "string" ? body.plan : "";
    amountCents = Math.floor(Number(body.amountCents ?? 0));
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  if (kind === "subscription") {
    const priceId = planToPriceId(plan);
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing Stripe price id for plan" },
        { status: 400 },
      );
    }
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgrade=success`,
      cancel_url: `${appUrl}/pricing?canceled=1`,
      metadata: {
        kind: "subscription",
        plan,
        userId: session.user.id,
      },
      client_reference_id: session.user.id,
      allow_promotion_codes: true,
    });
    return NextResponse.redirect(checkout.url!, 303);
  }

  if (kind === "wallet_topup") {
    if (!Number.isFinite(amountCents) || amountCents < 100) {
      return NextResponse.json(
        { error: "amountCents must be >= 100" },
        { status: 400 },
      );
    }
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Peakpoints wallet top-up" },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/peakpoints?topup=success`,
      cancel_url: `${appUrl}/peakpoints?topup=canceled`,
      metadata: {
        kind: "wallet_topup",
        amountCents: String(amountCents),
        userId: session.user.id,
      },
      client_reference_id: session.user.id,
    });

    // For client JS callers, return URL JSON; for form posts, redirect.
    if (!contentType.includes("application/x-www-form-urlencoded")) {
      return NextResponse.json({ url: checkout.url });
    }
    return NextResponse.redirect(checkout.url!, 303);
  }

  return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
}

