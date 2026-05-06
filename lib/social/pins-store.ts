import "server-only";

import { Pool } from "pg";

import { db } from "@/lib/db";

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
async function ensureSchema() {
  if (!postgresPool) return;
  if (!schemaReady) {
    schemaReady = postgresPool
      .query(`
        CREATE TABLE IF NOT EXISTS pinned_posts (
          user_id TEXT NOT NULL,
          post_key TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, post_key)
        );
      `)
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS pinned_posts_user_idx ON pinned_posts(user_id, created_at DESC)",
        ),
      )
      .then(() => undefined);
  }
  await schemaReady;
}

export type PinEntry = {
  postKey: string;
  createdAt: string;
};

type PinnedPostRow = { post_key: string; created_at: string };

/** Ordered pins with timestamps (Repeaks etc.). Same row order as legacy `listPins`. */
export async function listPinEntries(
  userId: string,
  limit = 50,
): Promise<PinEntry[]> {
  const capped = Math.min(100, Math.max(1, limit));
  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<PinnedPostRow>(
      `SELECT post_key, created_at FROM pinned_posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, capped],
    );
    return result.rows.map((r) => ({
      postKey: r.post_key,
      createdAt: r.created_at,
    }));
  }

  const rows = db
    .prepare(
      `SELECT post_key, created_at FROM pinned_posts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(userId, capped) as PinnedPostRow[];
  return rows.map((r) => ({ postKey: r.post_key, createdAt: r.created_at }));
}

export async function listPins(userId: string): Promise<string[]> {
  const rows = await listPinEntries(userId, 50);
  return rows.map((r) => r.postKey);
}

export async function togglePin(input: { userId: string; postKey: string }) {
  const createdAt = new Date().toISOString();
  if (postgresPool) {
    await ensureSchema();
    const del = await postgresPool.query(
      `DELETE FROM pinned_posts WHERE user_id = $1 AND post_key = $2`,
      [input.userId, input.postKey],
    );
    if ((del.rowCount ?? 0) > 0) return { pinned: false };
    await postgresPool.query(
      `INSERT INTO pinned_posts (user_id, post_key, created_at) VALUES ($1, $2, $3)`,
      [input.userId, input.postKey, createdAt],
    );
    return { pinned: true };
  }

  const del = db
    .prepare(`DELETE FROM pinned_posts WHERE user_id = ? AND post_key = ?`)
    .run(input.userId, input.postKey);
  if (del.changes > 0) return { pinned: false };
  db.prepare(`INSERT INTO pinned_posts (user_id, post_key, created_at) VALUES (?, ?, ?)`).run(
    input.userId,
    input.postKey,
    createdAt,
  );
  return { pinned: true };
}

