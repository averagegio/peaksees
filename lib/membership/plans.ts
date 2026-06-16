export type MemberPlan = "free" | "peakplus" | "peakpro" | "peakenterprise";

export const MEMBER_PLAN_RANK: Record<MemberPlan, number> = {
  free: 0,
  peakplus: 1,
  peakpro: 2,
  peakenterprise: 3,
};

export function normalizeMemberPlan(raw: string | null | undefined): MemberPlan {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "peakplus" || v === "peakpro" || v === "peakenterprise") return v;
  return "free";
}

export function hasPeakPlusTier(plan: MemberPlan): boolean {
  return MEMBER_PLAN_RANK[plan] >= MEMBER_PLAN_RANK.peakplus;
}

export function hasPeakProTier(plan: MemberPlan): boolean {
  return MEMBER_PLAN_RANK[plan] >= MEMBER_PLAN_RANK.peakpro;
}

export function memberPlanLabel(plan: MemberPlan): string | null {
  if (plan === "peakplus") return "PeakPlus";
  if (plan === "peakpro") return "PeakPro";
  if (plan === "peakenterprise") return "PeakEnterprise";
  return null;
}
