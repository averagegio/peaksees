import "server-only";

export function appBaseUrl() {
  const explicit = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return "https://peaksees.vercel.app";
}

export function marketSharePageUrl(marketId: string) {
  return `${appBaseUrl()}/m/${encodeURIComponent(marketId.trim())}`;
}

export function marketContractPageUrl(marketId: string) {
  return `${marketSharePageUrl(marketId)}/contract`;
}

export function marketShareImageUrl(marketId: string) {
  /** Bump when share capture layout changes so X/LinkedIn refresh cached previews. */
  return `${appBaseUrl()}/api/markets/${encodeURIComponent(marketId.trim())}/share-image?v=6`;
}

function embedQuery(params: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** OBS browser source — compact live odds bar (transparent). */
export function twitchEmbedOverlayUrl(input: { channel?: string; marketId?: string }) {
  const base = `${appBaseUrl()}/embed/twitch`;
  return `${base}${embedQuery({
    channel: input.channel?.trim(),
    market: input.marketId?.trim(),
    mode: "overlay",
    transparent: "1",
  })}`;
}

/** Phone / Twitch panel — interactive bet UI. */
export function twitchEmbedPanelUrl(input: { channel?: string; marketId?: string }) {
  const base = `${appBaseUrl()}/embed/twitch`;
  return `${base}${embedQuery({
    channel: input.channel?.trim(),
    market: input.marketId?.trim(),
    mode: "panel",
  })}`;
}

export function twitchEmbedMarketUrl(marketId: string, mode: "overlay" | "panel" = "overlay") {
  const base = `${appBaseUrl()}/embed/market/${encodeURIComponent(marketId.trim())}`;
  return `${base}${embedQuery({
    mode,
    ...(mode === "overlay" ? { transparent: "1" } : {}),
  })}`;
}
