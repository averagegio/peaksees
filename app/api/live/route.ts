import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import {
  createLiveKitJoinToken,
  getLiveKitConfig,
  hasLiveKitServerCredentials,
} from "@/lib/live/livekit";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url, roomName } = getLiveKitConfig();
  const configured = hasLiveKitServerCredentials() && Boolean(url);

  return NextResponse.json({
    configured,
    url: configured ? url : null,
    roomName,
    provider: "livekit" as const,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasLiveKitServerCredentials()) {
    return NextResponse.json(
      {
        error:
          "Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and NEXT_PUBLIC_LIVEKIT_URL (wss://…).",
      },
      { status: 400 },
    );
  }

  const { url, roomName } = getLiveKitConfig();
  if (!url) {
    return NextResponse.json(
      { error: "Set NEXT_PUBLIC_LIVEKIT_URL to your LiveKit WebSocket URL." },
      { status: 400 },
    );
  }

  let role: "publisher" | "viewer" = "viewer";
  try {
    const body = (await request.json().catch(() => ({}))) as {
      role?: string;
    };
    if (body.role === "publisher" || body.role === "viewer") {
      role = body.role;
    }
  } catch {
    // default viewer
  }

  try {
    const token = await createLiveKitJoinToken({
      identity: session.user.id,
      name: session.user.displayName,
      role,
      roomName,
    });

    return NextResponse.json({
      token,
      url,
      roomName,
      role,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create LiveKit token";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
