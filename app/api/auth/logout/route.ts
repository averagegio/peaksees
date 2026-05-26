import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth/cookie-session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}

/** Clears session cookie in the browser (fixes stale-cookie redirect loops in dev). */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const res = NextResponse.redirect(`${origin}/login`);
  clearSessionCookie(res);
  return res;
}
