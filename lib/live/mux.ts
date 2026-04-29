import "server-only";

import Mux from "@mux/mux-node";

type MuxLivePlayback = { id: string; policy?: string };

export function hasMuxCredentials() {
  return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

export function getMuxClient() {
  if (!hasMuxCredentials()) return null;
  return new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
  });
}

export function getConfiguredMuxIds() {
  return {
    playbackId: process.env.MUX_PLAYBACK_ID ?? "",
    liveStreamId: process.env.MUX_LIVE_STREAM_ID ?? "",
  };
}

export function readPlaybackId(playbackIds: MuxLivePlayback[] | undefined) {
  if (!playbackIds || playbackIds.length === 0) return "";
  const pub = playbackIds.find((p) => p.policy === "public");
  return pub?.id ?? playbackIds[0]?.id ?? "";
}
