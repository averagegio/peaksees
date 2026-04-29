import { jwtVerify } from "jose";

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) {
    return new TextEncoder().encode("peaksees-dev-secret-change-me");
  }
  return new TextEncoder().encode(s);
}

export async function isSessionCookieValid(token: string | undefined) {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}
