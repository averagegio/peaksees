import "server-only";

export function appBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return "https://peaksees.vercel.app";
}

export function marketSharePageUrl(marketId: string) {
  return `${appBaseUrl()}/m/${encodeURIComponent(marketId.trim())}`;
}

export function marketShareImageUrl(marketId: string) {
  return `${appBaseUrl()}/api/markets/${encodeURIComponent(marketId.trim())}/share-image`;
}
