import "server-only";

import type Stripe from "stripe";

import { setUserMemberPlan } from "@/lib/auth/users-store";
import { hasPeakPlusTier, normalizeMemberPlan, type MemberPlan } from "@/lib/membership/plans";

import {
  highestPaidPlan,
  planFromActiveSubscription,
  planFromStripePriceId,
} from "./plan-from-subscription";
import { getStripe } from "./server";

const CACHE_TTL_MS = 30_000;
const planCache = new Map<string, { plan: MemberPlan | null; at: number }>();

function cacheKey(userId: string, email?: string | null) {
  return `${userId.trim()}|${(email ?? "").trim().toLowerCase()}`;
}

export function clearMemberPlanSyncCache() {
  planCache.clear();
}

function firstPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items?.data?.[0];
  const price = item?.price;
  if (!price) return null;
  return typeof price === "string" ? price : (price.id ?? null);
}

export function planFromStripeSubscription(
  sub: Stripe.Subscription,
): MemberPlan | null {
  return planFromActiveSubscription({
    status: sub.status,
    priceId: firstPriceId(sub),
    metadataPlan: sub.metadata?.plan,
  });
}

async function lookupActiveStripePlanUncached(input: {
  userId: string;
  email?: string | null;
}): Promise<MemberPlan | null> {
  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return null;
  }

  const plans: Array<MemberPlan | null> = [];
  const userId = input.userId.trim();
  const email = (input.email ?? "").trim().toLowerCase();

  if (userId) {
    try {
      const found = await stripe.subscriptions.search({
        query: `metadata["userId"]:"${userId.replace(/"/g, "")}"`,
        limit: 10,
      });
      for (const sub of found.data) {
        plans.push(planFromStripeSubscription(sub));
      }
    } catch {
      // Search is not enabled on every Stripe account.
    }

    try {
      const found = await stripe.checkout.sessions.search({
        query: `metadata["userId"]:"${userId.replace(/"/g, "")}" AND status:"complete"`,
        limit: 10,
      });
      for (const checkout of found.data) {
        if (checkout.mode !== "subscription") continue;
        const fromMeta = normalizeMemberPlan(checkout.metadata?.plan);
        if (hasPeakPlusTier(fromMeta)) {
          plans.push(fromMeta);
          continue;
        }
        const linePrice =
          checkout.line_items?.data?.[0]?.price &&
          typeof checkout.line_items.data[0].price !== "string"
            ? checkout.line_items.data[0].price.id
            : null;
        plans.push(
          planFromStripePriceId(linePrice) ??
            (checkout.payment_status === "paid" || checkout.status === "complete"
              ? "peakplus"
              : null),
        );
      }
    } catch {
      // Search is not enabled on every Stripe account.
    }
  }

  if (email) {
    try {
      const customers = await stripe.customers.list({ email, limit: 8 });
      for (const customer of customers.data) {
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 20,
        });
        for (const sub of subs.data) {
          plans.push(planFromStripeSubscription(sub));
        }
      }
    } catch {
      // Network / key errors should not block the desk.
    }
  }

  return highestPaidPlan(plans);
}

export async function lookupActiveStripePlan(input: {
  userId: string;
  email?: string | null;
}): Promise<MemberPlan | null> {
  const key = cacheKey(input.userId, input.email);
  const hit = planCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.plan;

  const plan = await lookupActiveStripePlanUncached(input);
  planCache.set(key, { plan, at: now });
  return plan;
}

/**
 * Prefer the stored `member_plan`. If it is still Free but Stripe shows an
 * active paid subscription, persist PeakPlus (or higher) and return that.
 */
export async function resolveEffectiveMemberPlan(user: {
  id: string;
  email?: string | null;
  memberPlan?: string | null;
}): Promise<MemberPlan> {
  const stored = normalizeMemberPlan(user.memberPlan);
  if (hasPeakPlusTier(stored)) return stored;

  try {
    const fromStripe = await lookupActiveStripePlan({
      userId: user.id,
      email: user.email,
    });
    if (fromStripe && hasPeakPlusTier(fromStripe)) {
      await setUserMemberPlan(user.id, fromStripe);
      return fromStripe;
    }
  } catch {
    // Keep the stored plan if Stripe is down.
  }

  return stored;
}
