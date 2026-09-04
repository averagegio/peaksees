import { NextResponse } from "next/server";

import { clearPersonalDeskCookie } from "@/lib/unusual-whales/cookie";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearPersonalDeskCookie(res);
  return res;
}
