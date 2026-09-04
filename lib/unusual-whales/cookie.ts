import type { NextResponse } from "next/server";

import { UW_PERSONAL_COOKIE } from "./config";

const MONTH = 60 * 60 * 24 * 30;

function cookieShouldBeSecure(request?: Request): boolean {
  // Vercel preview + production are HTTPS. Do not set Domain (host-only) so
  // cookies work on *.vercel.app and www.peaksees.com without Public Suffix issues.
  if (process.env.VERCEL === "1") return true;
  const forwarded = request?.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() === "https";
  }
  if (request) {
    try {
      return new URL(request.url).protocol === "https:";
    } catch {
      // ignore invalid URL
    }
  }
  return false;
}

export function personalDeskCookieOptions(request?: Request) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: cookieShouldBeSecure(request),
    maxAge: MONTH,
    priority: "high" as const,
  };
}

export function attachPersonalDeskCookie(
  response: NextResponse,
  token: string,
  request?: Request,
) {
  response.cookies.set({
    name: UW_PERSONAL_COOKIE,
    value: token,
    ...personalDeskCookieOptions(request),
  });
}

export function clearPersonalDeskCookie(response: NextResponse, request?: Request) {
  response.cookies.set({
    name: UW_PERSONAL_COOKIE,
    value: "",
    ...personalDeskCookieOptions(request),
    maxAge: 0,
  });
}
