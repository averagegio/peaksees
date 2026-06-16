import "server-only";

import fs from "node:fs";

import {
  animeUploadsDir,
  buildAnimeStorageKey,
  uploadAnimeVideoLocal,
} from "@/lib/anime/video-storage";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { db } from "@/lib/db";

export type AnimeEpisode = {
  id: string;
  userId: string;
  creatorName: string;
  creatorHandle: string;
  seriesTitle: string;
  title: string;
  episodeNumber: number;
  description: string;
  mimeType: string;
  fileName: string;
  storageKey: string;
  createdAt: string;
};

type AnimeEpisodeRow = {
  id: string;
  user_id: string;
  creator_name: string;
  creator_handle: string;
  series_title: string;
  title: string;
  episode_number: number;
  description: string;
  mime_type: string;
  file_name: string;
  storage_key: string | null;
  created_at: string;
};

const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
const postgresPool = postgresUrl
  ? new Pool({
      connectionString: postgresUrl,
      ssl: postgresUrl.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    })
  : null;

let schemaReady: Promise<void> | null = null;

function rowToEpisode(row: AnimeEpisodeRow): AnimeEpisode {
  const storageKey =
    row.storage_key?.trim() ||
    buildAnimeStorageKey(row.id, row.file_name || "episode.mp4");
  return {
    id: row.id,
    userId: row.user_id,
    creatorName: row.creator_name,
    creatorHandle: row.creator_handle,
    seriesTitle: row.series_title,
    title: row.title,
    episodeNumber: row.episode_number,
    description: row.description,
    mimeType: row.mime_type,
    fileName: row.file_name,
    storageKey,
    createdAt: row.created_at,
  };
}

const EPISODE_SELECT = `id, user_id, creator_name, creator_handle, series_title, title,
  episode_number, description, mime_type, file_name, storage_key, created_at`;

async function ensureStorageKeyColumnSqlite() {
  const cols = db.prepare("PRAGMA table_info(anime_episodes)").all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === "storage_key")) {
    db.exec("ALTER TABLE anime_episodes ADD COLUMN storage_key TEXT");
  }
}

export async function ensureAnimeEpisodesSchema(): Promise<void> {
  if (postgresPool) {
    if (!schemaReady) {
      schemaReady = postgresPool
        .query(`
          CREATE TABLE IF NOT EXISTS anime_episodes (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            creator_name TEXT NOT NULL,
            creator_handle TEXT NOT NULL,
            series_title TEXT NOT NULL,
            title TEXT NOT NULL,
            episode_number INTEGER NOT NULL DEFAULT 1,
            description TEXT NOT NULL DEFAULT '',
            mime_type TEXT NOT NULL,
            file_name TEXT NOT NULL,
            storage_key TEXT,
            created_at TEXT NOT NULL
          );
        `)
        .then(() =>
          postgresPool.query(
            "ALTER TABLE anime_episodes ADD COLUMN IF NOT EXISTS storage_key TEXT",
          ),
        )
        .then(() =>
          postgresPool.query(
            "CREATE INDEX IF NOT EXISTS anime_episodes_created_at_idx ON anime_episodes(created_at DESC)",
          ),
        )
        .then(() =>
          postgresPool.query(
            "CREATE INDEX IF NOT EXISTS anime_episodes_user_idx ON anime_episodes(user_id, created_at DESC)",
          ),
        )
        .then(() => undefined);
    }
    await schemaReady;
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS anime_episodes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      creator_handle TEXT NOT NULL,
      series_title TEXT NOT NULL,
      title TEXT NOT NULL,
      episode_number INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      storage_key TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS anime_episodes_created_at_idx ON anime_episodes(created_at DESC);
    CREATE INDEX IF NOT EXISTS anime_episodes_user_idx ON anime_episodes(user_id, created_at DESC);
  `);
  await ensureStorageKeyColumnSqlite();
  fs.mkdirSync(animeUploadsDir(), { recursive: true });
}

export async function listAnimeEpisodes(input?: {
  limit?: number;
}): Promise<AnimeEpisode[]> {
  await ensureAnimeEpisodesSchema();
  const limit = Math.max(1, Math.min(50, Math.floor(input?.limit ?? 24)));

  if (postgresPool) {
    const result = await postgresPool.query<AnimeEpisodeRow>(
      `SELECT ${EPISODE_SELECT}
       FROM anime_episodes
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(rowToEpisode);
  }

  const rows = db
    .prepare(
      `SELECT ${EPISODE_SELECT}
       FROM anime_episodes
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(limit) as AnimeEpisodeRow[];
  return rows.map(rowToEpisode);
}

export async function getAnimeEpisodeById(id: string): Promise<AnimeEpisode | null> {
  await ensureAnimeEpisodesSchema();
  const episodeId = id.trim();
  if (!episodeId) return null;

  if (postgresPool) {
    const result = await postgresPool.query<AnimeEpisodeRow>(
      `SELECT ${EPISODE_SELECT} FROM anime_episodes WHERE id = $1 LIMIT 1`,
      [episodeId],
    );
    return result.rows[0] ? rowToEpisode(result.rows[0]) : null;
  }

  const row = db
    .prepare(`SELECT ${EPISODE_SELECT} FROM anime_episodes WHERE id = ? LIMIT 1`)
    .get(episodeId) as AnimeEpisodeRow | undefined;
  return row ? rowToEpisode(row) : null;
}

async function insertEpisodeRow(input: {
  id: string;
  userId: string;
  creatorName: string;
  creatorHandle: string;
  seriesTitle: string;
  title: string;
  episodeNumber: number;
  description: string;
  mimeType: string;
  fileName: string;
  storageKey: string;
  createdAt: string;
}) {
  if (postgresPool) {
    await postgresPool.query(
      `INSERT INTO anime_episodes
       (id, user_id, creator_name, creator_handle, series_title, title, episode_number,
        description, mime_type, file_name, storage_key, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        input.id,
        input.userId,
        input.creatorName.slice(0, 64),
        input.creatorHandle.slice(0, 32),
        input.seriesTitle.slice(0, 120),
        input.title.slice(0, 120),
        input.episodeNumber,
        input.description.slice(0, 500),
        input.mimeType,
        input.fileName.slice(0, 180),
        input.storageKey,
        input.createdAt,
      ],
    );
    return;
  }

  db.prepare(
    `INSERT INTO anime_episodes
     (id, user_id, creator_name, creator_handle, series_title, title, episode_number,
      description, mime_type, file_name, storage_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.userId,
    input.creatorName.slice(0, 64),
    input.creatorHandle.slice(0, 32),
    input.seriesTitle.slice(0, 120),
    input.title.slice(0, 120),
    input.episodeNumber,
    input.description.slice(0, 500),
    input.mimeType,
    input.fileName.slice(0, 180),
    input.storageKey,
    input.createdAt,
  );
}

/** Register episode after direct R2 upload (production). */
export async function registerAnimeEpisode(input: {
  id: string;
  userId: string;
  creatorName: string;
  creatorHandle: string;
  seriesTitle: string;
  title: string;
  episodeNumber: number;
  description: string;
  mimeType: string;
  fileName: string;
  storageKey: string;
}): Promise<AnimeEpisode> {
  await ensureAnimeEpisodesSchema();
  const createdAt = new Date().toISOString();
  const episodeNumber = Math.max(1, Math.min(999, Math.floor(input.episodeNumber)));

  await insertEpisodeRow({
    ...input,
    episodeNumber,
    createdAt,
  });

  return {
    id: input.id,
    userId: input.userId,
    creatorName: input.creatorName,
    creatorHandle: input.creatorHandle,
    seriesTitle: input.seriesTitle,
    title: input.title,
    episodeNumber,
    description: input.description,
    mimeType: input.mimeType,
    fileName: input.fileName,
    storageKey: input.storageKey,
    createdAt,
  };
}

/** Local dev: upload file through API and save to disk. */
export async function createAnimeEpisode(input: {
  userId: string;
  creatorName: string;
  creatorHandle: string;
  seriesTitle: string;
  title: string;
  episodeNumber: number;
  description: string;
  mimeType: string;
  fileName: string;
  fileBuffer: Buffer;
}): Promise<AnimeEpisode> {
  await ensureAnimeEpisodesSchema();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const episodeNumber = Math.max(1, Math.min(999, Math.floor(input.episodeNumber)));
  const storageKey = buildAnimeStorageKey(id, input.fileName);

  await uploadAnimeVideoLocal(storageKey, input.fileBuffer);

  await insertEpisodeRow({
    id,
    userId: input.userId,
    creatorName: input.creatorName,
    creatorHandle: input.creatorHandle,
    seriesTitle: input.seriesTitle,
    title: input.title,
    episodeNumber,
    description: input.description,
    mimeType: input.mimeType,
    fileName: input.fileName,
    storageKey,
    createdAt,
  });

  return {
    id,
    userId: input.userId,
    creatorName: input.creatorName,
    creatorHandle: input.creatorHandle,
    seriesTitle: input.seriesTitle,
    title: input.title,
    episodeNumber,
    description: input.description,
    mimeType: input.mimeType,
    fileName: input.fileName,
    storageKey,
    createdAt,
  };
}
