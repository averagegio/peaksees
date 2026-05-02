import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/users-store";
import {
  getFollowCounts,
  isFollowing,
  setFollowRelation,
} from "@/lib/social/follows-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = (url.searchParams.get("userId") ?? "").trim();
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const session = await getSession();
  const counts = await getFollowCounts(userId);
  let isFollowingViewer = false;
  if (session && session.user.id !== userId) {
    isFollowingViewer = await isFollowing(session.user.id, userId);
  }

  return NextResponse.json({
    userId,
    followersCount: counts.followers,
    followingCount: counts.following,
    ...(session ? { isFollowing: isFollowingViewer } : {}),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: unknown; follow?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetId = typeof body.userId === "string" ? body.userId.trim() : "";
  const follow = body.follow === true;
  const unfollow = body.follow === false;
  if (!targetId || (!follow && !unfollow)) {
    return NextResponse.json(
      { error: "Provide userId and follow: true | false" },
      { status: 400 },
    );
  }

  const target = await getUserById(targetId);
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const result = await setFollowRelation(session.user.id, targetId, follow);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const counts = await getFollowCounts(targetId);
  const nowFollowing = await isFollowing(session.user.id, targetId);

  return NextResponse.json({
    userId: targetId,
    followersCount: counts.followers,
    followingCount: counts.following,
    isFollowing: nowFollowing,
  });
}
