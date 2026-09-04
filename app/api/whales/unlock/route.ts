import { NextResponse } from "next/server";

import { attachPersonalDeskCookie } from "@/lib/unusual-whales/cookie";
import {
  createPersonalDeskCookieValue,
  tokensMatch,
} from "@/lib/unusual-whales/access";
import { getPersonalAccessToken } from "@/lib/unusual-whales/config";

export async function POST(request: Request) {
  const expected = getPersonalAccessToken();
  if (!expected) {
    return NextResponse.json(
      { error: "Personal access token is not configured (UW_PERSONAL_ACCESS_TOKEN)." },
      { status: 503 },
    );
  }

  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  if (!token || !tokensMatch(token, expected)) {
    return NextResponse.json({ error: "Invalid access token" }, { status: 401 });
  }

  const value = await createPersonalDeskCookieValue();
  const res = NextResponse.json({ ok: true });
  attachPersonalDeskCookie(res, value);
  return res;
}
