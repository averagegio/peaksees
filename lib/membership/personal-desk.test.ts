import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  evaluatePersonalDeskAccess,
  whalesUnlockScreen,
} from "./personal-desk.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

export async function testUnlockFormAlwaysShowsTokenField() {
  const missing = whalesUnlockScreen({ tokenConfigured: false });
  const present = whalesUnlockScreen({ tokenConfigured: true });
  assert(missing.showOwnerTokenField === true, "field shown when server token missing");
  assert(present.showOwnerTokenField === true, "field shown when server token set");
  assert(missing.ownerTokenFieldLabel === "Peak Flow owner token", "label");
  assert(missing.ownerTokenFieldId === "uw-token", "input id");
  assert(missing.showNotConfiguredHint === true, "hint when unset");
  assert(present.showNotConfiguredHint === false, "no hint when set");

  const formPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../app/whales/WhalesUnlockForm.tsx",
  );
  const source = readFileSync(formPath, "utf8");
  assert(source.includes('data-testid="peak-flow-owner-token"'), "password input in unlock form");
  assert(source.includes('htmlFor={screen.ownerTokenFieldId}'), "label wired to token field");
  assert(!source.includes("tokenConfigured ?"), "field is not gated on server env");
}

export async function testFreeSessionSeesLock() {
  const loggedOut = evaluatePersonalDeskAccess({ signedIn: false, memberPlan: "free" });
  const free = evaluatePersonalDeskAccess({ signedIn: true, memberPlan: "free" });
  assert(loggedOut.ok === false, "logged out locked");
  assert(free.ok === false, "free member locked");
}

export async function testPeakPlusSessionOpensWhales() {
  const plus = evaluatePersonalDeskAccess({ signedIn: true, memberPlan: "peakplus" });
  const pro = evaluatePersonalDeskAccess({ signedIn: true, memberPlan: "PeakPro" });
  const stale = evaluatePersonalDeskAccess({
    signedIn: true,
    memberPlan: "free",
    stripeSubscriptionActive: true,
  });
  assert(plus.ok && plus.via === "peakplus", "PeakPlus opens /whales");
  assert(pro.ok && pro.via === "peakplus", "PeakPro opens /whales");
  assert(stale.ok && stale.via === "peakplus", "stale free + Stripe opens /whales");
}

export async function testOwnerAndCookieStillOpen() {
  const owner = evaluatePersonalDeskAccess({ isOwner: true, memberPlan: "free" });
  const cookie = evaluatePersonalDeskAccess({ hasPersonalCookie: true, memberPlan: "free" });
  assert(owner.ok && owner.via === "owner", "owner email");
  assert(cookie.ok && cookie.via === "cookie", "personal cookie");
}

export async function testAdminFlagDoesNotOpenWithoutOwnerOrPlan() {
  const result = evaluatePersonalDeskAccess({
    signedIn: true,
    memberPlan: "free",
    isOwner: false,
  } as { signedIn: boolean; memberPlan: string; isOwner: boolean });
  assert(result.ok === false, "plain free session stays locked");
}

const tests = [
  testUnlockFormAlwaysShowsTokenField,
  testFreeSessionSeesLock,
  testPeakPlusSessionOpensWhales,
  testOwnerAndCookieStillOpen,
  testAdminFlagDoesNotOpenWithoutOwnerOrPlan,
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
