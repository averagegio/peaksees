import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { SESSION_COOKIE } from "./constants";
import { getUserById, toPublicUser, type StoredUser } from "./users-store";

type JwtPayload = {
  sub: string;
  email?: string;
};

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }
    return new TextEncoder().encode("peaksees-dev-secret-change-me");
  }
  return new TextEncoder().encode(s);
}

export async function createSessionToken(user: StoredUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.displayName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) return null;
    return { sub, email: typeof payload.email === "string" ? payload.email : undefined };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{
  user: ReturnType<typeof toPublicUser>;
} | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const stored = await getUserById(payload.sub);
  if (!stored) return null;
  return { user: toPublicUser(stored) };
}
