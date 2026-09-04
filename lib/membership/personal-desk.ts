import { hasPeakPlusTier, normalizeMemberPlan, type MemberPlan } from "./plans";

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
