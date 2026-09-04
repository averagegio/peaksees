import "server-only";

import type Stripe from "stripe";

import {
  hasPeakPlusTier,
  normalizeMemberPlan,
  planFromActiveSubscription,
  planFromStripePriceId,
  type MemberPlan,
} from "@/lib/membership/plans";
import { setUserMemberPlan } from "@/lib/auth/users-store";

function planFromCheckoutMetadata(
  metadata: Stripe.Metadata | null | undefined,
): MemberPlan | null {
  const plan = normalizeMemberPlan(metadata?.plan);
  return plan === "free" ? null : plan;
}

function firstLinePriceId(checkout: Stripe.Checkout.Session): string | null {
  const price = checkout.line_items?.data?.[0]?.price;
  if (!price) return null;
  return typeof price === "string" ? price : (price.id ?? null);
}

export async function fulfillSubscriptionCheckout(
  checkout: Stripe.Checkout.Session,
): Promise<void> {
  if (checkout.mode !== "subscription") return;
  const userId = (checkout.metadata?.userId ?? checkout.client_reference_id ?? "").trim();
  if (!userId) return;

  const fromMeta = planFromCheckoutMetadata(checkout.metadata);
  const fromPrice = planFromStripePriceId(firstLinePriceId(checkout));
  const completed =
    checkout.payment_status === "paid" ||
    checkout.status === "complete" ||
    checkout.status === "open";
  const plan = fromMeta ?? fromPrice ?? (completed ? "peakplus" : null);
  if (!plan || !hasPeakPlusTier(plan)) return;
  await setUserMemberPlan(userId, plan);
}

export async function fulfillStripeSubscription(
  sub: Stripe.Subscription,
): Promise<void> {
  const userId = (sub.metadata?.userId ?? "").trim();
  const item = sub.items?.data?.[0];
  const price = item?.price;
  const priceId = !price ? null : typeof price === "string" ? price : price.id;
  const plan = planFromActiveSubscription({
    status: sub.status,
    priceId,
    metadataPlan: sub.metadata?.plan,
  });
  if (!userId || !plan || !hasPeakPlusTier(plan)) return;
  await setUserMemberPlan(userId, plan);
}

export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const direct = (invoice as { subscription?: string | { id?: string } | null }).subscription;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (direct && typeof direct === "object" && typeof direct.id === "string") {
    return direct.id.trim();
  }
  const parent = (
    invoice as {
      parent?: {
        subscription_details?: { subscription?: string | null };
      } | null;
    }
  ).parent?.subscription_details?.subscription;
  return typeof parent === "string" && parent.trim() ? parent.trim() : null;
}

export async function clearUserSubscription(userId: string): Promise<void> {
  const id = userId.trim();
  if (!id) return;
  await setUserMemberPlan(id, "free");
}
