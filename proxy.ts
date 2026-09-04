import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isSessionCookieValid } from "@/lib/auth/verify-middleware";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Peak Flow personal desk (/whales) uses owner token, ADMIN_EMAILS, or a
  // PeakPlus session. Never redirect the unlock page to /login.
  if (pathname.startsWith("/whales") || pathname.startsWith("/api/whales")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = await isSessionCookieValid(token);

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/feed") ||
    pathname.startsWith("/bookmarks") ||
    pathname.startsWith("/mentions") ||
    pathname.startsWith("/peakflow")
  ) {
    if (!authed) {
      const u = req.nextUrl.clone();
      u.pathname = "/login";
      u.searchParams.set("next", pathname);
      return NextResponse.redirect(u);
    }
    // Signed-in /peakflow still plan-gates in the page: free → upgrade CTA.
    // ADMIN_EMAILS / UW personal token must not unlock subscriber Peakflow.
    return NextResponse.next();
  }

  // Login/signup: do not redirect here (Edge cannot read SQLite). Pages use getSession().
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/feed/:path*",
    "/bookmarks/:path*",
    "/mentions/:path*",
    "/peakflow/:path*",
    "/whales",
    "/whales/:path*",
    "/api/whales/:path*",
    "/login",
    "/signup",
  ],
};
