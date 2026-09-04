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
  if (v === "peakplus" || v === "plus" || v === "peak+") return "peakplus";
  if (v === "peakpro" || v === "pro") return "peakpro";
  if (v === "peakenterprise" || v === "enterprise") return "peakenterprise";
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
}): SubscriberDeskDecision {
  if (!input.signedIn) {
    return {
      ok: false,
      status: 401,
      code: "unauthenticated",
      error: "Sign in to view Peakflow.",
    };
  }

  const plan = normalizeMemberPlan(input.memberPlan);
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
