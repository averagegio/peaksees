import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import {
  getConfiguredMuxIds,
  getMuxClient,
  hasMuxCredentials,
  readPlaybackId,
} from "@/lib/live/mux";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { playbackId: envPlaybackId, liveStreamId } = getConfiguredMuxIds();
  const mux = getMuxClient();

  if (!mux) {
    return NextResponse.json({
      configured: Boolean(envPlaybackId),
      playbackId: envPlaybackId || null,
      status: "offline",
      source: envPlaybackId ? "env_playback_id" : "none",
      canCreate: false,
    });
  }

  if (!liveStreamId) {
    return NextResponse.json({
      configured: Boolean(envPlaybackId),
      playbackId: envPlaybackId || null,
      status: "offline",
      source: envPlaybackId ? "env_playback_id" : "mux_missing_stream_id",
      canCreate: true,
    });
  }

  try {
    const stream = await mux.video.liveStreams.retrieve(liveStreamId);
    const streamPlaybackId = readPlaybackId(
      stream.playback_ids as Array<{ id: string; policy?: string }> | undefined,
    );

    return NextResponse.json({
      configured: Boolean(streamPlaybackId || envPlaybackId),
      playbackId: streamPlaybackId || envPlaybackId || null,
      status: stream.status ?? "unknown",
      source: "mux_live_stream",
      canCreate: true,
      liveStreamId: stream.id,
    });
  } catch {
    return NextResponse.json({
      configured: Boolean(envPlaybackId),
      playbackId: envPlaybackId || null,
      status: "offline",
      source: "mux_error",
      canCreate: true,
    });
  }
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMuxCredentials()) {
    return NextResponse.json(
      { error: "Set MUX_TOKEN_ID and MUX_TOKEN_SECRET first." },
      { status: 400 },
    );
  }

  const mux = getMuxClient();
  if (!mux) {
    return NextResponse.json({ error: "Mux client unavailable" }, { status: 500 });
  }

  try {
    const stream = await mux.video.liveStreams.create({
      playback_policy: ["public"],
      new_asset_settings: { playback_policy: ["public"] },
      latency_mode: "low",
    });
    const playbackId = readPlaybackId(
      stream.playback_ids as Array<{ id: string; policy?: string }> | undefined,
    );

    return NextResponse.json({
      liveStreamId: stream.id,
      playbackId: playbackId || null,
      streamKey: stream.stream_key,
      status: stream.status ?? "idle",
      rtmpUrl: "rtmp://global-live.mux.com:5222/app",
    });
  } catch {
    return NextResponse.json(
      { error: "Could not create a Mux live stream right now." },
      { status: 500 },
    );
  }
}
