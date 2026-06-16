import { NextResponse } from "next/server";

import { registerAnimeEpisode } from "@/lib/anime/episodes-store";
import { parseAnimeEpisodeMeta } from "@/lib/anime/upload-constants";
import { isR2Configured } from "@/lib/anime/video-storage";
import { getSession } from "@/lib/auth/session";
import { hasPeakProTier } from "@/lib/membership/plans";

export const runtime = "nodejs";

function episodeJson(ep: Awaited<ReturnType<typeof registerAnimeEpisode>>) {
  return {
    id: ep.id,
    userId: ep.userId,
    creatorName: ep.creatorName,
    creatorHandle: ep.creatorHandle,
    seriesTitle: ep.seriesTitle,
    title: ep.title,
    episodeNumber: ep.episodeNumber,
    description: ep.description,
    createdAt: ep.createdAt,
    videoUrl: `/api/anime/episodes/${encodeURIComponent(ep.id)}/video`,
  };
}

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
      { error: "Direct upload completion requires R2 configuration" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const episodeId = String(body.episodeId ?? "").trim();
  const storageKey = String(body.storageKey ?? "").trim();
  const fileName = String(body.fileName ?? "").trim();
  const mimeType = String(body.mimeType ?? "").trim() || "video/mp4";

  if (!episodeId || !storageKey || !fileName) {
    return NextResponse.json(
      { error: "episodeId, storageKey, and fileName are required" },
      { status: 400 },
    );
  }

  if (!storageKey.startsWith("anime/") || !storageKey.includes(episodeId)) {
    return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
  }

  const meta = parseAnimeEpisodeMeta(body);
  if ("error" in meta) {
    return NextResponse.json({ error: meta.error }, { status: 400 });
  }

  const episode = await registerAnimeEpisode({
    id: episodeId,
    userId: session.user.id,
    creatorName: session.user.displayName,
    creatorHandle: session.user.atHandle ?? `@${session.user.handle}`,
    seriesTitle: meta.seriesTitle,
    title: meta.title,
    episodeNumber: meta.episodeNumber,
    description: meta.description,
    mimeType,
    fileName,
    storageKey,
  });

  return NextResponse.json({ episode: episodeJson(episode) });
}
