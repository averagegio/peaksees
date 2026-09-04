import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { attachPersonalDeskCookie, personalDeskCookieOptions } from "@/lib/unusual-whales/cookie";
import { createPersonalDeskCookieValue } from "@/lib/unusual-whales/access";
import {
  UW_PERSONAL_COOKIE,
  getPersonalAccessToken,
  getUnusualWhalesApiKey,
} from "@/lib/unusual-whales/config";
import { normalizeAccessToken, tokensMatch } from "@/lib/unusual-whales/token-compare";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = getPersonalAccessToken();
  if (!expected) {
    return NextResponse.json(
      {
        error: "Unlock isn't configured. Set UW_PERSONAL_ACCESS_TOKEN on the server and redeploy.",
        code: "not_configured",
      },
      { status: 503 },
    );
  }

  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON", code: "invalid_json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const normalized = normalizeAccessToken(token);
  if (!normalized) {
    return NextResponse.json(
      { error: "Enter the Peak Flow owner token.", code: "missing_token" },
      { status: 400 },
    );
  }

  if (!tokensMatch(normalized, expected)) {
    const apiKey = getUnusualWhalesApiKey();
    if (apiKey && tokensMatch(normalized, apiKey)) {
      return NextResponse.json(
        {
          error:
            "That's the Unusual Whales API key, not the Peak Flow owner token. Use UW_PERSONAL_ACCESS_TOKEN.",
          code: "wrong_token_kind",
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        error:
          "Invalid Peak Flow owner token. This is UW_PERSONAL_ACCESS_TOKEN, not UNUSUAL_WHALES_API_KEY.",
        code: "invalid_token",
      },
      { status: 401 },
    );
  }

  const value = await createPersonalDeskCookieValue();
  const res = NextResponse.json({ ok: true });
  attachPersonalDeskCookie(res, value, request);
  const jar = await cookies();
  jar.set({
    name: UW_PERSONAL_COOKIE,
    value,
    ...personalDeskCookieOptions(request),
  });
  return res;
}
