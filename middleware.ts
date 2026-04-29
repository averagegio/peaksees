import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isSessionCookieValid } from "@/lib/auth/verify-middleware";

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authed = await isSessionCookieValid(token);
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/feed") ||
    pathname.startsWith("/bookmarks") ||
    pathname.startsWith("/mentions")
  ) {
    if (!authed) {
      const u = req.nextUrl.clone();
      u.pathname = "/login";
      u.searchParams.set("next", pathname);
      return NextResponse.redirect(u);
    }
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname === "/signup") {
    if (authed) {
      const u = req.nextUrl.clone();
      u.pathname = "/feed";
      u.search = "";
      return NextResponse.redirect(u);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/feed/:path*",
    "/bookmarks/:path*",
    "/mentions/:path*",
    "/login",
    "/signup",
  ],
};
