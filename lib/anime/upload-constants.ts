export const ANIME_MAX_BYTES = 120 * 1024 * 1024; // 120 MB

export const ANIME_ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

export function parseAnimeEpisodeMeta(input: {
  seriesTitle?: unknown;
  title?: unknown;
  description?: unknown;
  episodeNumber?: unknown;
}) {
  const seriesTitle = String(input.seriesTitle ?? "").trim();
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  const episodeNumber = Math.floor(Number(input.episodeNumber ?? "1"));

  if (!seriesTitle || !title) {
    return { error: "seriesTitle and title are required" as const };
  }

  return {
    seriesTitle,
    title,
    description,
    episodeNumber,
  };
}
