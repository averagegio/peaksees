import "server-only";

import { AccessToken } from "livekit-server-sdk";

export function getLiveKitConfig() {
  const apiKey = (process.env.LIVEKIT_API_KEY ?? "").trim();
  const apiSecret = (process.env.LIVEKIT_API_SECRET ?? "").trim();
  /** WebSocket URL for clients, e.g. wss://your-project.livekit.cloud */
  const url = (process.env.NEXT_PUBLIC_LIVEKIT_URL ?? "").trim();
  const roomName = (process.env.LIVEKIT_ROOM ?? "peaksees-live").trim() || "peaksees-live";
  return { apiKey, apiSecret, url, roomName };
}

export function hasLiveKitServerCredentials() {
  const { apiKey, apiSecret } = getLiveKitConfig();
  return Boolean(apiKey && apiSecret);
}

export async function createLiveKitJoinToken(opts: {
  identity: string;
  name: string;
  role: "publisher" | "viewer";
  roomName: string;
}) {
  const { apiKey, apiSecret } = getLiveKitConfig();
  if (!apiKey || !apiSecret) {
    throw new Error("Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET");
  }

  const canPublish = opts.role === "publisher";

  const token = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.name,
    ttl: "6h",
  });

  token.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  return token.toJwt();
}
