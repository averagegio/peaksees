import { NextResponse } from "next/server";

import { attachSessionCookie } from "@/lib/auth/cookie-session";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";
import { createUser } from "@/lib/auth/users-store";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: string; password?: string; displayName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const displayNameRaw =
    typeof body.displayName === "string" ? body.displayName : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 },
    );
  }
  const displayName = safeDisplay(displayNameRaw, email);

  const passwordHash = await hashPassword(password);
  const outcome = await createUser({ email, passwordHash, displayName });

  if ("error" in outcome) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const token = await createSessionToken(outcome);
  const res = NextResponse.json({
    user: {
      id: outcome.id,
      email: outcome.email,
      displayName: outcome.displayName,
      createdAt: outcome.createdAt,
    },
  });
  attachSessionCookie(res, token);
  return res;
}

function safeDisplay(raw: string, email: string) {
  const t = raw.trim().slice(0, 64);
  if (t.length >= 2) return t;
  const local = (email.split("@")[0] ?? "you").slice(0, 64);
  if (local.length >= 2) return local;
  return "Trader";
}

