import fs from "node:fs";

import { NextResponse } from "next/server";

import { getAnimeEpisodeById } from "@/lib/anime/episodes-store";
import { getAnimeVideoPlayback } from "@/lib/anime/video-storage";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const episode = await getAnimeEpisodeById(decodeURIComponent(id ?? "").trim());
  if (!episode) {
    return NextResponse.json({ error: "Episode not found" }, { status: 404 });
  }

  try {
    const playback = await getAnimeVideoPlayback({
      storageKey: episode.storageKey,
      mimeType: episode.mimeType,
      fileName: episode.fileName,
    });

    if (playback.kind === "redirect") {
      return NextResponse.redirect(playback.url, { status: 307 });
    }

    const data = fs.readFileSync(playback.filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": playback.mimeType || "video/mp4",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Video file missing" }, { status: 404 });
  }
}
