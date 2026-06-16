import "server-only";

import type Stripe from "stripe";

import { normalizeMemberPlan, type MemberPlan } from "@/lib/membership/plans";
import { setUserMemberPlan } from "@/lib/auth/users-store";

function planFromCheckoutMetadata(
  metadata: Stripe.Metadata | null | undefined,
): MemberPlan | null {
  const plan = normalizeMemberPlan(metadata?.plan);
  return plan === "free" ? null : plan;
}

export async function fulfillSubscriptionCheckout(
  checkout: Stripe.Checkout.Session,
): Promise<void> {
  if (checkout.mode !== "subscription") return;
  const userId = (checkout.metadata?.userId ?? checkout.client_reference_id ?? "").trim();
  const plan = planFromCheckoutMetadata(checkout.metadata);
  if (!userId || !plan) return;
  await setUserMemberPlan(userId, plan);
}

export async function clearUserSubscription(userId: string): Promise<void> {
  const id = userId.trim();
  if (!id) return;
  await setUserMemberPlan(id, "free");
}
