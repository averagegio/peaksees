import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { getSession } from "@/lib/auth/session";
import { evaluateSubscriberDeskAccess } from "@/lib/membership/plans";

import {
  UW_PERSONAL_COOKIE,
  adminEmails,
  getMcpBearerSecret,
  getPersonalAccessToken,
} from "./config";
import { tokensMatch } from "./token-compare";
import type { UnusualWhalesDesk } from "./types";

export { tokensMatch };

function jwtSecret() {
  const s = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!s) return new TextEncoder().encode("peaksees-dev-secret-change-me");
  return new TextEncoder().encode(s);
}

export async function createPersonalDeskCookieValue(): Promise<string> {
  return new SignJWT({ scope: "uw-personal" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("peaksees-owner")
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(jwtSecret());
}

export async function hasValidPersonalDeskCookie(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(UW_PERSONAL_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    return payload.scope === "uw-personal";
  } catch {
    return false;
  }
}

export async function isOwnerSession(): Promise<boolean> {
  const emails = adminEmails();
  if (emails.length === 0) return false;
  const session = await getSession();
  const email = session?.user.email?.toLowerCase() ?? "";
  return Boolean(email && emails.includes(email));
}

export async function canAccessPersonalDesk(): Promise<boolean> {
  if (await isOwnerSession()) return true;
  if (await hasValidPersonalDeskCookie()) return true;
  return false;
}

export async function canAccessSubscriberDesk(): Promise<boolean> {
  const session = await getSession();
  const access = evaluateSubscriberDeskAccess({
    signedIn: Boolean(session),
    memberPlan: session?.user.memberPlan,
    email: session?.user.email,
  });
  return access.ok;
}

export type DeskAccess =
  | { ok: true }
  | { ok: false; status: number; code: string; error: string };

export async function requireDeskAccess(desk: UnusualWhalesDesk): Promise<DeskAccess> {
  if (desk === "personal") {
    if (await canAccessPersonalDesk()) return { ok: true };
    const hasToken = Boolean(getPersonalAccessToken());
    const hasAdmins = adminEmails().length > 0;
    if (!hasToken && !hasAdmins) {
      return {
        ok: false,
        status: 503,
        code: "not_configured",
        error:
          "Unlock isn't configured. Set UW_PERSONAL_ACCESS_TOKEN (not the Unusual Whales API key) and/or ADMIN_EMAILS.",
      };
    }
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      error: "Owner sign-in or personal access token required.",
    };
  }

  // Subscriber desk (/peakflow + dashboard?desk=subscriber): plan only.
  // Do not consult ADMIN_EMAILS or UW_PERSONAL_ACCESS_TOKEN here.
  const session = await getSession();
  return evaluateSubscriberDeskAccess({
    signedIn: Boolean(session),
    memberPlan: session?.user.memberPlan,
    email: session?.user.email,
  });
}

export async function canAccessMcp(request: Request): Promise<boolean> {
  const secret = getMcpBearerSecret();
  const auth = request.headers.get("authorization") ?? "";
  if (secret && auth === `Bearer ${secret}`) return true;
  if (await canAccessPersonalDesk()) return true;
  if (await canAccessSubscriberDesk()) return true;
  return false;
}
