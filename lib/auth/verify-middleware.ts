import { jwtVerify } from "jose";

function getSecret() {
  const s = process.env.JWT_SECRET || process.env.AUTH_SECRET;
  if (!s) {
    return new TextEncoder().encode("peaksees-dev-secret-change-me");
  }
  return new TextEncoder().encode(s);
}

/** Edge-safe: JWT signature only (user lookup happens in Server Components). */
export async function isSessionCookieValid(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
