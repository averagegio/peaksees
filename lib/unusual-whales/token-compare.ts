import { createHash, timingSafeEqual } from "node:crypto";

/** Trim whitespace and optional wrapping quotes from env pastes / form input. */
export function normalizeAccessToken(value: string): string {
  let token = value.trim();
  if (token.length >= 2) {
    const start = token[0];
    const end = token[token.length - 1];
    if ((start === '"' && end === '"') || (start === "'" && end === "'")) {
      token = token.slice(1, -1).trim();
    }
  }
  return token;
}

/**
 * Timing-safe equality after normalize. Hashes first so length mismatch
 * does not short-circuit the compare.
 */
export function tokensMatch(provided: string, expected: string): boolean {
  const a = normalizeAccessToken(provided);
  const b = normalizeAccessToken(expected);
  if (a.length === 0 || b.length === 0) return false;
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}
