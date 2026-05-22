import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { toPublicUser, updateUserProfile } from "@/lib/auth/users-store";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    displayName?: string;
    bio?: string;
    handle?: string;
    avatarUrl?: string;
    bannerUrl?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const bio = typeof body.bio === "string" ? body.bio : "";
  const handle = typeof body.handle === "string" ? body.handle.trim() : undefined;
  const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl : undefined;
  const bannerUrl = typeof body.bannerUrl === "string" ? body.bannerUrl : undefined;

  if (displayName.length < 2) {
    return NextResponse.json(
      { error: "Display name must be at least 2 characters" },
      { status: 400 },
    );
  }

  if (avatarUrl && avatarUrl.length > 160_000) {
    return NextResponse.json(
      { error: "Profile photo is too large" },
      { status: 400 },
    );
  }
  if (avatarUrl && !avatarUrl.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Profile photo must be an image" },
      { status: 400 },
    );
  }
  if (bannerUrl && bannerUrl.length > 600_000) {
    return NextResponse.json(
      { error: "Header image is too large" },
      { status: 400 },
    );
  }
  if (bannerUrl && !bannerUrl.startsWith("data:image/")) {
    return NextResponse.json(
      { error: "Header image must be an image" },
      { status: 400 },
    );
  }

  const updated = await updateUserProfile(session.user.id, {
    displayName,
    bio,
    handle,
    avatarUrl,
    bannerUrl,
  });
  if (!updated) {
    return NextResponse.json({ error: "Unable to update profile" }, { status: 500 });
  }
  if ("error" in updated) {
    if (updated.error === "handle_taken") {
      return NextResponse.json({ error: "That @ handle is already taken" }, { status: 409 });
    }
    return NextResponse.json(
      { error: updated.message ?? "Invalid handle" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    user: toPublicUser(updated),
  });
}
