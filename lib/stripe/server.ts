import "server-only";

import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

export function getAppUrl() {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (explicit) return explicit;

  const vercelUrl = (process.env.VERCEL_URL ?? "").trim();
  if (!vercelUrl) return "http://localhost:3000";
  return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
}

