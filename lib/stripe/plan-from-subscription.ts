import {
  hasPeakPlusTier,
  normalizeMemberPlan,
  type MemberPlan,
} from "@/lib/membership/plans";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function isPaidStripeSubscriptionStatus(
  status: string | null | undefined,
): boolean {
  return ACTIVE_STATUSES.has((status ?? "").trim().toLowerCase());
}

export function planFromStripePriceId(
  priceId: string | null | undefined,
): MemberPlan | null {
  const id = (priceId ?? "").trim();
  if (!id) return null;
  const plus = (process.env.STRIPE_PRICE_PEAKPLUS ?? "").trim();
  const pro = (process.env.STRIPE_PRICE_PEAKPRO ?? "").trim();
  const ent = (process.env.STRIPE_PRICE_PEAKENTERPRISE ?? "").trim();
  if (plus && id === plus) return "peakplus";
  if (pro && id === pro) return "peakpro";
  if (ent && id === ent) return "peakenterprise";
  return null;
}

/**
 * Map an existing Stripe subscription onto a PeakSees plan.
 * An active/trialing/past_due subscription always counts as at least PeakPlus,
 * even when metadata/price ids were never written back to `member_plan`.
 */
export function planFromActiveSubscription(input: {
  status?: string | null;
  priceId?: string | null;
  metadataPlan?: string | null;
}): MemberPlan | null {
  if (!isPaidStripeSubscriptionStatus(input.status)) return null;
  const fromMeta = normalizeMemberPlan(input.metadataPlan);
  if (hasPeakPlusTier(fromMeta)) return fromMeta;
  const fromPrice = planFromStripePriceId(input.priceId);
  if (fromPrice) return fromPrice;
  return "peakplus";
}

export function highestPaidPlan(
  plans: Array<MemberPlan | null | undefined>,
): MemberPlan | null {
  let best: MemberPlan | null = null;
  for (const plan of plans) {
    const normalized = plan ? normalizeMemberPlan(plan) : "free";
    if (!hasPeakPlusTier(normalized)) continue;
    if (!best || rank(normalized) > rank(best)) best = normalized;
  }
  return best;
}

function rank(plan: MemberPlan): number {
  if (plan === "peakenterprise") return 3;
  if (plan === "peakpro") return 2;
  if (plan === "peakplus") return 1;
  return 0;
}
