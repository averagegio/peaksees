export const UW_API_BASE = "https://api.unusualwhales.com";
export const UW_CLIENT_API_ID = "100001";
export const UW_OFFICIAL_MCP_URL = "https://api.unusualwhales.com/api/mcp";
export const UW_CACHE_TTL_MS = 45_000;
export const UW_PERSONAL_COOKIE = "peaksees_uw_personal";

export function getUnusualWhalesApiKey(): string | null {
  const key = (
    process.env.UNUSUAL_WHALES_API_KEY ??
    process.env.UW_API_KEY ??
    ""
  ).trim();
  return key.length > 0 ? key : null;
}

export function isUnusualWhalesDemoMode(): boolean {
  const explicit = (process.env.UW_DEMO_MODE ?? "").trim().toLowerCase();
  if (explicit === "true" || explicit === "1") return true;
  if (explicit === "false" || explicit === "0") return false;
  return getUnusualWhalesApiKey() === null;
}

export function getPersonalAccessToken(): string | null {
  const token = (process.env.UW_PERSONAL_ACCESS_TOKEN ?? "").trim();
  return token.length > 0 ? token : null;
}

export function getMcpBearerSecret(): string | null {
  const token = (
    process.env.UW_MCP_TOKEN ??
    process.env.CRON_SECRET ??
    ""
  ).trim();
  return token.length > 0 ? token : null;
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
