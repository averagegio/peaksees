import "server-only";

import type Stripe from "stripe";

import {
  PLATFORM_FEE_RATE,
  peakpointsCreditAfterDepositFee,
} from "@/lib/peakpoints/fees";
import { tryCreditWalletTopupOnce } from "@/lib/peakpoints/ledger";

export async function fulfillWalletTopupCheckout(
  checkout: Stripe.Checkout.Session,
): Promise<{ ok: boolean; credited: boolean; creditedCents: number; reason?: string }> {
  const kind = String(checkout.metadata?.kind ?? "");
  const userId = String(checkout.metadata?.userId ?? "").trim();
  if (kind !== "wallet_topup" || !userId || checkout.mode !== "payment") {
    return { ok: false, credited: false, creditedCents: 0, reason: "not_wallet_topup" };
  }
  if (checkout.payment_status !== "paid") {
    return { ok: false, credited: false, creditedCents: 0, reason: "not_paid" };
  }

  const checkoutId = String(checkout.id ?? "").trim();
  if (!checkoutId) {
    return { ok: false, credited: false, creditedCents: 0, reason: "missing_checkout_id" };
  }

  const grossPaid = checkout.amount_total ?? 0;
  const creditedCents = peakpointsCreditAfterDepositFee(grossPaid);
  if (creditedCents <= 0) {
    return { ok: true, credited: false, creditedCents: 0, reason: "zero_credit" };
  }

  const didCredit = await tryCreditWalletTopupOnce({
    checkoutSessionId: checkoutId,
    userId,
    creditedCents,
    note: `Stripe wallet top-up (credit after ${Math.round(PLATFORM_FEE_RATE * 100)}% deposit fee on $${(grossPaid / 100).toFixed(2)} paid)`,
  });

  return { ok: true, credited: didCredit, creditedCents };
}
