export type MemberPlan = "free" | "peakplus" | "peakpro" | "peakenterprise";

export const MEMBER_PLAN_RANK: Record<MemberPlan, number> = {
  free: 0,
  peakplus: 1,
  peakpro: 2,
  peakenterprise: 3,
};

/** Monthly list prices shown on /pricing and the Peakflow upgrade gate. */
export const MEMBER_PLAN_MONTHLY_PRICE: Record<Exclude<MemberPlan, "free">, string> = {
  peakplus: "$10",
  peakpro: "$30",
  peakenterprise: "$50",
};

export const PEAKPLUS_MONTHLY_PRICE = MEMBER_PLAN_MONTHLY_PRICE.peakplus;

function collapsePlanToken(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function normalizeMemberPlan(raw: string | null | undefined): MemberPlan {
  const v = collapsePlanToken(raw);
  if (
    v === "peakplus" ||
    v === "plus" ||
    v === "peak+" ||
    v === "premium" ||
    v === "paid" ||
    v === "subscriber" ||
    v === "peakplusmonthly" ||
    v === "plusmonthly"
  ) {
    return "peakplus";
  }
  if (v === "peakpro" || v === "pro" || v === "peakpromonthly" || v === "promonthly") {
    return "peakpro";
  }
  if (
    v === "peakenterprise" ||
    v === "enterprise" ||
    v === "peakenterprisemonthly"
  ) {
    return "peakenterprise";
  }
  return "free";
}

export function hasPeakPlusTier(plan: string | null | undefined): boolean {
  return MEMBER_PLAN_RANK[normalizeMemberPlan(plan)] >= MEMBER_PLAN_RANK.peakplus;
}

export function hasPeakProTier(plan: string | null | undefined): boolean {
  return MEMBER_PLAN_RANK[normalizeMemberPlan(plan)] >= MEMBER_PLAN_RANK.peakpro;
}

export function memberPlanLabel(plan: MemberPlan): string | null {
  if (plan === "peakplus") return "PeakPlus";
  if (plan === "peakpro") return "PeakPro";
  if (plan === "peakenterprise") return "PeakEnterprise";
  return null;
}

export function memberPlanDisplayName(plan: string | null | undefined): string {
  return memberPlanLabel(normalizeMemberPlan(plan)) ?? "Free";
}

export type SubscriberDeskDecision =
  | { ok: true; plan: MemberPlan }
  | { ok: false; status: 401; code: "unauthenticated"; error: string }
  | { ok: false; status: 403; code: "unsubscribed"; error: string };

/**
 * Peakflow (`/peakflow`) is PeakPlus-or-higher only.
 * Owner/admin email and the UW personal token must never unlock this desk.
 */
export function planAllowsPeakflow(plan: string | null | undefined): boolean {
  return hasPeakPlusTier(plan);
}

export function evaluateSubscriberDeskAccess(input: {
  signedIn: boolean;
  memberPlan?: string | null;
  /** Accepted so callers can pass session email; ignored for Peakflow. */
  email?: string | null;
  /** ADMIN_EMAILS / owner flag — ignored. Admin bypass is /whales only. */
  isAdmin?: boolean;
  hasPersonalToken?: boolean;
  /** Active / trialing / past_due Stripe subscription — honors a paid upgrade. */
  stripeSubscriptionActive?: boolean;
  stripePlan?: string | null;
}): SubscriberDeskDecision {
  if (!input.signedIn) {
    return {
      ok: false,
      status: 401,
      code: "unauthenticated",
      error: "Sign in to view Peakflow.",
    };
  }

  const stored = normalizeMemberPlan(input.memberPlan);
  const fromStripeField = normalizeMemberPlan(input.stripePlan);
  const fromStripeActive =
    input.stripeSubscriptionActive === true ? ("peakplus" as const) : null;
  const plan = hasPeakPlusTier(stored)
    ? stored
    : hasPeakPlusTier(fromStripeField)
      ? fromStripeField
      : (fromStripeActive ?? stored);

  if (!planAllowsPeakflow(plan)) {
    return {
      ok: false,
      status: 403,
      code: "unsubscribed",
      error: "Upgrade your plan to PeakPlus or higher to open Peakflow.",
    };
  }

  return { ok: true, plan };
}

export function peakflowUpgradeCopy(plan: string | null | undefined): {
  eyebrow: string;
  title: string;
  body: string;
  currentPlanLabel: string;
  requiredPlanLabel: string;
  price: string;
  cta: string;
  href: "/pricing";
} {
  const current = normalizeMemberPlan(plan);
  return {
    eyebrow: "Upgrade required",
    title: "Upgrade your plan to get into Peakflow",
    body: `You're on the ${memberPlanDisplayName(current)} plan. Peakflow is included with PeakPlus (${PEAKPLUS_MONTHLY_PRICE}/mo) or higher — PeakPro and PeakEnterprise also unlock it.`,
    currentPlanLabel: memberPlanDisplayName(current),
    requiredPlanLabel: "PeakPlus",
    price: `${PEAKPLUS_MONTHLY_PRICE}/mo`,
    cta: `Upgrade to PeakPlus — ${PEAKPLUS_MONTHLY_PRICE}/mo`,
    href: "/pricing",
  };
}

export type PersonalDeskVia = "owner" | "cookie" | "peakplus";

export type PersonalDeskDecision =
  | { ok: true; via: PersonalDeskVia; plan: MemberPlan | null }
  | { ok: false };

/**
 * `/whales` (installable Peak Flow) is enterable by owner email, the
 * UW personal cookie, or a PeakPlus-or-higher Peaksees session.
 */
export function evaluatePersonalDeskAccess(input: {
  isOwner?: boolean;
  hasPersonalCookie?: boolean;
  signedIn?: boolean;
  memberPlan?: string | null;
  stripeSubscriptionActive?: boolean;
  stripePlan?: string | null;
}): PersonalDeskDecision {
  if (input.isOwner) {
    return { ok: true, via: "owner", plan: normalizeMemberPlan(input.memberPlan) };
  }
  if (input.hasPersonalCookie) {
    return { ok: true, via: "cookie", plan: normalizeMemberPlan(input.memberPlan) };
  }

  if (!input.signedIn) return { ok: false };

  const stored = normalizeMemberPlan(input.memberPlan);
  const fromStripeField = normalizeMemberPlan(input.stripePlan);
  const fromStripeActive =
    input.stripeSubscriptionActive === true ? ("peakplus" as const) : null;
  const plan = hasPeakPlusTier(stored)
    ? stored
    : hasPeakPlusTier(fromStripeField)
      ? fromStripeField
      : (fromStripeActive ?? stored);

  if (!hasPeakPlusTier(plan)) return { ok: false };
  return { ok: true, via: "peakplus", plan };
}

/** Unlock UI always includes the owner-token field — even if the server env is unset. */
export function whalesUnlockScreen(input: { tokenConfigured: boolean }) {
  return {
    showOwnerTokenField: true as const,
    ownerTokenFieldLabel: "Peak Flow owner token",
    ownerTokenFieldId: "uw-token",
    showNotConfiguredHint: !input.tokenConfigured,
  };
}

const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function isPaidStripeSubscriptionStatus(
  status: string | null | undefined,
): boolean {
  return ACTIVE_STRIPE_STATUSES.has((status ?? "").trim().toLowerCase());
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
    if (!best || MEMBER_PLAN_RANK[normalized] > MEMBER_PLAN_RANK[best]) best = normalized;
  }
  return best;
}
