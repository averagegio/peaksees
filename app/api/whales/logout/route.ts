import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { UW_PERSONAL_COOKIE } from "@/lib/unusual-whales/config";
import { clearPersonalDeskCookie, personalDeskCookieOptions } from "@/lib/unusual-whales/cookie";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const res = NextResponse.json({ ok: true });
  clearPersonalDeskCookie(res, request);
  const jar = await cookies();
  jar.set({
    name: UW_PERSONAL_COOKIE,
    value: "",
    ...personalDeskCookieOptions(request),
    maxAge: 0,
  });
  return res;
}
