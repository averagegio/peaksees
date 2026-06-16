import fs from "node:fs";

import { NextResponse } from "next/server";

import { createAnimeEpisode, listAnimeEpisodes } from "@/lib/anime/episodes-store";
import {
  ANIME_ALLOWED_TYPES,
  ANIME_MAX_BYTES,
  parseAnimeEpisodeMeta,
} from "@/lib/anime/upload-constants";
import { animeVideoUploadMode } from "@/lib/anime/video-storage";
import { getSession } from "@/lib/auth/session";
import { hasPeakProTier } from "@/lib/membership/plans";

export const runtime = "nodejs";

function episodeJson(ep: Awaited<ReturnType<typeof listAnimeEpisodes>>[number]) {
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

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.floor(Number(url.searchParams.get("limit") ?? "24"));
  const episodes = await listAnimeEpisodes({ limit });
  return NextResponse.json({
    episodes: episodes.map(episodeJson),
    canUpload: hasPeakProTier(session.user.memberPlan),
    uploadMode: animeVideoUploadMode(),
  });
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

  if (animeVideoUploadMode() === "direct") {
    return NextResponse.json(
      {
        error:
          "Use direct upload: POST /api/anime/episodes/upload-url then PUT to R2, then POST /api/anime/episodes/complete",
        uploadMode: "direct",
      },
      { status: 400 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("video");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "video file is required" }, { status: 400 });
  }

  if (!ANIME_ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported format. Use MP4 or WebM." },
      { status: 400 },
    );
  }

  if (file.size > ANIME_MAX_BYTES) {
    return NextResponse.json({ error: "Video must be under 120 MB" }, { status: 400 });
  }

  const meta = parseAnimeEpisodeMeta({
    seriesTitle: form.get("seriesTitle"),
    title: form.get("title"),
    description: form.get("description"),
    episodeNumber: form.get("episodeNumber"),
  });
  if ("error" in meta) {
    return NextResponse.json({ error: meta.error }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const episode = await createAnimeEpisode({
    userId: session.user.id,
    creatorName: session.user.displayName,
    creatorHandle: session.user.atHandle ?? `@${session.user.handle}`,
    seriesTitle: meta.seriesTitle,
    title: meta.title,
    episodeNumber: meta.episodeNumber,
    description: meta.description,
    mimeType: file.type || "video/mp4",
    fileName: file.name || "episode.mp4",
    fileBuffer: buffer,
  });

  return NextResponse.json({ episode: episodeJson(episode), uploadMode: "server" });
}
