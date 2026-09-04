import {
  evaluateSubscriberDeskAccess,
  hasPeakPlusTier,
  hasPeakProTier,
  memberPlanDisplayName,
  normalizeMemberPlan,
  peakflowUpgradeCopy,
  PEAKPLUS_MONTHLY_PRICE,
  planAllowsPeakflow,
} from "./plans.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

export async function testNormalizeMemberPlanAliases() {
  assert(normalizeMemberPlan(undefined) === "free", "undefined → free");
  assert(normalizeMemberPlan(null) === "free", "null → free");
  assert(normalizeMemberPlan("") === "free", "empty → free");
  assert(normalizeMemberPlan("  ") === "free", "blank → free");
  assert(normalizeMemberPlan("unknown") === "free", "unknown → free");
  assert(normalizeMemberPlan("owner") === "free", "owner is not a plan");
  assert(normalizeMemberPlan("admin") === "free", "admin is not a plan");

  assert(normalizeMemberPlan("peakplus") === "peakplus", "canonical peakplus");
  assert(normalizeMemberPlan("PeakPlus") === "peakplus", "PeakPlus casing");
  assert(normalizeMemberPlan("plus") === "peakplus", "plus alias");
  assert(normalizeMemberPlan("peak_plus") === "peakplus", "peak_plus");
  assert(normalizeMemberPlan("peak-plus") === "peakplus", "peak-plus");
  assert(normalizeMemberPlan("peak plus") === "peakplus", "peak plus");

  assert(normalizeMemberPlan("peakpro") === "peakpro", "canonical peakpro");
  assert(normalizeMemberPlan("PeakPro") === "peakpro", "PeakPro casing");
  assert(normalizeMemberPlan("pro") === "peakpro", "pro alias");

  assert(normalizeMemberPlan("peakenterprise") === "peakenterprise", "canonical enterprise");
  assert(normalizeMemberPlan("enterprise") === "peakenterprise", "enterprise alias");
}

export async function testHasPeakPlusTierDeniesFreeAndUnknown() {
  assert(hasPeakPlusTier(undefined) === false, "undefined denied");
  assert(hasPeakPlusTier(null) === false, "null denied");
  assert(hasPeakPlusTier("free") === false, "free denied");
  assert(hasPeakPlusTier("Free") === false, "Free denied");
  assert(hasPeakPlusTier("") === false, "empty denied");
  assert(hasPeakPlusTier("owner") === false, "owner string denied");
  assert(hasPeakPlusTier("admin") === false, "admin string denied");
}

export async function testHasPeakPlusTierAllowsPaidTiers() {
  assert(hasPeakPlusTier("peakplus") === true, "peakplus allowed");
  assert(hasPeakPlusTier("PeakPlus") === true, "PeakPlus allowed");
  assert(hasPeakPlusTier("plus") === true, "plus allowed");
  assert(hasPeakPlusTier("peakpro") === true, "peakpro allowed");
  assert(hasPeakPlusTier("peakenterprise") === true, "enterprise allowed");
}

export async function testHasPeakProTier() {
  assert(hasPeakProTier("free") === false, "free is not pro");
  assert(hasPeakProTier("peakplus") === false, "plus is not pro");
  assert(hasPeakProTier("peakpro") === true, "pro is pro");
  assert(hasPeakProTier("peakenterprise") === true, "enterprise is pro");
}

export async function testDisplayNameAndPrice() {
  assert(memberPlanDisplayName("free") === "Free", "free label");
  assert(memberPlanDisplayName(undefined) === "Free", "unknown label");
  assert(memberPlanDisplayName("peakplus") === "PeakPlus", "plus label");
  assert(PEAKPLUS_MONTHLY_PRICE === "$10", "PeakPlus list price matches /pricing");
}

export async function testPlanAllowsPeakflow() {
  assert(planAllowsPeakflow(undefined) === false, "undefined denied");
  assert(planAllowsPeakflow("free") === false, "free denied");
  assert(planAllowsPeakflow("peakplus") === true, "peakplus allowed");
  assert(planAllowsPeakflow("peakpro") === true, "peakpro allowed");
}

export async function testLoggedOutIsLoginNotUpgrade() {
  const result = evaluateSubscriberDeskAccess({
    signedIn: false,
    memberPlan: "free",
  });
  assert(result.ok === false, "logged out denied");
  if (result.ok) return;
  assert(result.status === 401, "401 when logged out");
  assert(result.code === "unauthenticated", "unauthenticated code");
}

export async function testFreeMemberGetsUnsubscribed() {
  const result = evaluateSubscriberDeskAccess({
    signedIn: true,
    memberPlan: "free",
    email: "member@example.com",
  });
  assert(result.ok === false, "free denied");
  if (result.ok) return;
  assert(result.status === 403, "403 for free plan");
  assert(result.code === "unsubscribed", "unsubscribed code");
  assert(result.error.toLowerCase().includes("upgrade"), "error mentions upgrade");
}

export async function testUnknownPlanIsDenied() {
  const result = evaluateSubscriberDeskAccess({
    signedIn: true,
    memberPlan: undefined,
  });
  assert(result.ok === false, "missing plan denied");
  if (result.ok) return;
  assert(result.code === "unsubscribed", "missing plan is unsubscribed, not silent allow");
}

export async function testPeakPlusAndHigherAllowed() {
  const plus = evaluateSubscriberDeskAccess({ signedIn: true, memberPlan: "peakplus" });
  const pro = evaluateSubscriberDeskAccess({ signedIn: true, memberPlan: "PeakPro" });
  const ent = evaluateSubscriberDeskAccess({ signedIn: true, memberPlan: "enterprise" });
  assert(plus.ok && plus.plan === "peakplus", "peakplus ok");
  assert(pro.ok && pro.plan === "peakpro", "peakpro ok");
  assert(ent.ok && ent.plan === "peakenterprise", "enterprise ok");
}

export async function testOwnerEmailDoesNotGrantPeakflow() {
  const result = evaluateSubscriberDeskAccess({
    signedIn: true,
    memberPlan: "free",
    email: "mrigwe234@gmail.com",
    isAdmin: true,
    hasPersonalToken: true,
  });
  assert(result.ok === false, "owner/admin must not skip Peakflow plan gate");
  if (result.ok) return;
  assert(result.code === "unsubscribed", "still unsubscribed on free plan");
}

export async function testUpgradeCopyNamesPeakPlusAndPricing() {
  const copy = peakflowUpgradeCopy("free");
  assert(copy.title.toLowerCase().includes("upgrade"), "title says upgrade");
  assert(copy.title.toLowerCase().includes("peakflow"), "title names Peakflow");
  assert(copy.currentPlanLabel === "Free", "shows Free plan");
  assert(copy.requiredPlanLabel === "PeakPlus", "names PeakPlus");
  assert(copy.price === "$10/mo", "shows PeakPlus price");
  assert(copy.cta.includes("Upgrade to PeakPlus"), "CTA is upgrade");
  assert(copy.cta.includes("$10"), "CTA includes price");
  assert(copy.href === "/pricing", "CTA goes to /pricing");
  assert(copy.body.includes("Free"), "body mentions current plan");
  assert(copy.body.includes("PeakPlus"), "body mentions PeakPlus");
}

const tests = [
  testNormalizeMemberPlanAliases,
  testHasPeakPlusTierDeniesFreeAndUnknown,
  testHasPeakPlusTierAllowsPaidTiers,
  testHasPeakProTier,
  testDisplayNameAndPrice,
  testPlanAllowsPeakflow,
  testLoggedOutIsLoginNotUpgrade,
  testFreeMemberGetsUnsubscribed,
  testUnknownPlanIsDenied,
  testPeakPlusAndHigherAllowed,
  testOwnerEmailDoesNotGrantPeakflow,
  testUpgradeCopyNamesPeakPlusAndPricing,
];

async function main() {
  let failed = 0;
  for (const test of tests) {
    try {
      await test();
      console.log(`ok  ${test.name}`);
    } catch (err) {
      failed += 1;
      console.error(`fail ${test.name}:`, err instanceof Error ? err.message : err);
    }
  }
  if (failed > 0) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log(`${tests.length} passed`);
}

void main();
