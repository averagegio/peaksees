import {
  isPaidStripeSubscriptionStatus,
  planFromActiveSubscription,
  planFromStripePriceId,
  highestPaidPlan,
} from "./plan-from-subscription.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

export async function testPaidStatuses() {
  assert(isPaidStripeSubscriptionStatus("active") === true, "active");
  assert(isPaidStripeSubscriptionStatus("trialing") === true, "trialing");
  assert(isPaidStripeSubscriptionStatus("past_due") === true, "past_due");
  assert(isPaidStripeSubscriptionStatus("canceled") === false, "canceled");
  assert(isPaidStripeSubscriptionStatus("incomplete") === false, "incomplete");
  assert(isPaidStripeSubscriptionStatus("") === false, "empty");
}

export async function testActiveSubscriptionIsPeakPlus() {
  const plan = planFromActiveSubscription({ status: "active" });
  assert(plan === "peakplus", "active without metadata is PeakPlus");
}

export async function testCanceledSubscriptionDoesNotCount() {
  const plan = planFromActiveSubscription({
    status: "canceled",
    metadataPlan: "peakplus",
  });
  assert(plan === null, "canceled does not grant a plan");
}

export async function testMetadataAndPriceWin() {
  const prev = {
    STRIPE_PRICE_PEAKPLUS: process.env.STRIPE_PRICE_PEAKPLUS,
    STRIPE_PRICE_PEAKPRO: process.env.STRIPE_PRICE_PEAKPRO,
    STRIPE_PRICE_PEAKENTERPRISE: process.env.STRIPE_PRICE_PEAKENTERPRISE,
  };
  try {
    process.env.STRIPE_PRICE_PEAKPLUS = "price_plus";
    process.env.STRIPE_PRICE_PEAKPRO = "price_pro";
    process.env.STRIPE_PRICE_PEAKENTERPRISE = "price_ent";

    assert(planFromStripePriceId("price_pro") === "peakpro", "price id");
    assert(
      planFromActiveSubscription({ status: "active", metadataPlan: "PeakEnterprise" }) ===
        "peakenterprise",
      "metadata plan",
    );
    assert(
      planFromActiveSubscription({ status: "trialing", priceId: "price_pro" }) === "peakpro",
      "price on trial",
    );
  } finally {
    for (const [name, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

export async function testHighestPaidPlan() {
  assert(highestPaidPlan(["free", null, "peakplus"]) === "peakplus", "plus");
  assert(highestPaidPlan(["peakplus", "peakpro"]) === "peakpro", "pro wins");
  assert(highestPaidPlan(["free", "canceled" as never]) === null, "none");
}

const tests = [
  testPaidStatuses,
  testActiveSubscriptionIsPeakPlus,
  testCanceledSubscriptionDoesNotCount,
  testMetadataAndPriceWin,
  testHighestPaidPlan,
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
