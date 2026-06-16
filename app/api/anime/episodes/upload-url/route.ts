import { NextResponse } from "next/server";

import { createAnimeUploadTarget, isR2Configured } from "@/lib/anime/video-storage";
import {
  ANIME_ALLOWED_TYPES,
  ANIME_MAX_BYTES,
  parseAnimeEpisodeMeta,
} from "@/lib/anime/upload-constants";
import { getSession } from "@/lib/auth/session";
import { hasPeakProTier } from "@/lib/membership/plans";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!hasPeakProTier(session.user.memberPlan)) {
    return NextResponse.json(
      { error: "PeakPro membership required to upload anime episodes" },
      { status: 403 },
    );
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Direct upload is only available when R2 is configured" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fileName = String(body.fileName ?? "").trim();
  const mimeType = String(body.mimeType ?? "").trim() || "video/mp4";
  const sizeBytes = Math.floor(Number(body.sizeBytes ?? 0));

  if (!fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }

  if (!ANIME_ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported format. Use MP4 or WebM." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return NextResponse.json({ error: "sizeBytes is required" }, { status: 400 });
  }

  if (sizeBytes > ANIME_MAX_BYTES) {
    return NextResponse.json({ error: "Video must be under 120 MB" }, { status: 400 });
  }

  const meta = parseAnimeEpisodeMeta(body);
  if ("error" in meta) {
    return NextResponse.json({ error: meta.error }, { status: 400 });
  }

  try {
    const target = await createAnimeUploadTarget({
      fileName,
      mimeType,
      sizeBytes,
    });

    return NextResponse.json({
      uploadMode: "direct" as const,
      episodeId: target.episodeId,
      storageKey: target.storageKey,
      uploadUrl: target.uploadUrl,
      expiresInSec: target.expiresInSec,
      ...meta,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
