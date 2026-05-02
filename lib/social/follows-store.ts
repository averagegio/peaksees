import "server-only";

import { db } from "@/lib/db";
import { Pool } from "pg";

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

async function ensureFollowsSchema() {
  if (!postgresPool) return;
  if (!schemaReady) {
    const pool = postgresPool;
    schemaReady = pool
      .query(`
        CREATE TABLE IF NOT EXISTS user_follows (
          follower_id TEXT NOT NULL,
          following_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (follower_id, following_id),
          CHECK (follower_id <> following_id)
        );
      `)
      .then(() =>
        pool.query(
          "CREATE INDEX IF NOT EXISTS user_follows_following_idx ON user_follows(following_id)",
        ),
      )
      .then(() =>
        pool.query(
          "CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON user_follows(follower_id)",
        ),
      )
      .then(() => undefined);
  }
  await schemaReady;
}

export async function getFollowCounts(userId: string): Promise<{
  followers: number;
  following: number;
}> {
  if (postgresPool) {
    await ensureFollowsSchema();
    const followers = await postgresPool.query<{ c: string }>(
      `SELECT COUNT(*)::text as c FROM user_follows WHERE following_id = $1`,
      [userId],
    );
    const following = await postgresPool.query<{ c: string }>(
      `SELECT COUNT(*)::text as c FROM user_follows WHERE follower_id = $1`,
      [userId],
    );
    return {
      followers: Number(followers.rows[0]?.c ?? 0),
      following: Number(following.rows[0]?.c ?? 0),
    };
  }

  const f1 = db
    .prepare(
      `SELECT COUNT(*) as c FROM user_follows WHERE following_id = ?`,
    )
    .get(userId) as { c: number };
  const f2 = db
    .prepare(`SELECT COUNT(*) as c FROM user_follows WHERE follower_id = ?`)
    .get(userId) as { c: number };
  return {
    followers: Number(f1?.c ?? 0),
    following: Number(f2?.c ?? 0),
  };
}

export async function isFollowing(
  followerId: string,
  followingId: string,
): Promise<boolean> {
  if (followerId === followingId) return false;
  if (postgresPool) {
    await ensureFollowsSchema();
    const result = await postgresPool.query<{ ok: number }>(
      `SELECT 1 as ok FROM user_follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`,
      [followerId, followingId],
    );
    return (result.rows?.length ?? 0) > 0;
  }

  const row = db
    .prepare(
      `SELECT 1 as ok FROM user_follows WHERE follower_id = ? AND following_id = ? LIMIT 1`,
    )
    .get(followerId, followingId) as { ok: number } | undefined;
  return Boolean(row?.ok);
}

export async function setFollowRelation(
  followerId: string,
  followingId: string,
  wantFollow: boolean,
): Promise<{ ok: true } | { error: string }> {
  if (!followerId.trim() || !followingId.trim()) {
    return { error: "Invalid user ids" };
  }
  if (followerId === followingId) {
    return { error: "Cannot follow yourself" };
  }

  const now = new Date().toISOString();

  if (postgresPool) {
    await ensureFollowsSchema();
    if (wantFollow) {
      await postgresPool.query(
        `INSERT INTO user_follows (follower_id, following_id, created_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (follower_id, following_id) DO NOTHING`,
        [followerId, followingId, now],
      );
    } else {
      await postgresPool.query(
        `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
        [followerId, followingId],
      );
    }
    return { ok: true };
  }

  if (wantFollow) {
    db.prepare(
      `INSERT OR IGNORE INTO user_follows (follower_id, following_id, created_at)
       VALUES (?, ?, ?)`,
    ).run(followerId, followingId, now);
  } else {
    db.prepare(
      `DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?`,
    ).run(followerId, followingId);
  }
  return { ok: true };
}
