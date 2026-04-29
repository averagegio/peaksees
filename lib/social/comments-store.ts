import "server-only";

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { db } from "@/lib/db";

export type Comment = {
  id: string;
  postKey: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  text: string;
  createdAt: string;
  upvotes: number;
  viewerUpvoted: boolean;
};

type CommentRow = {
  id: string;
  post_key: string;
  user_id: string;
  text: string;
  created_at: string;
  display_name: string;
  avatar_url: string | null;
  upvotes: number;
  viewer_upvoted: number;
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
async function ensureSchema() {
  if (!postgresPool) return;
  if (!schemaReady) {
    schemaReady = postgresPool
      .query(`
        CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          post_key TEXT NOT NULL,
          user_id TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `)
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS comments_post_created_at_idx ON comments(post_key, created_at DESC)",
        ),
      )
      .then(() =>
        postgresPool.query(`
          CREATE TABLE IF NOT EXISTS comment_upvotes (
            comment_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (comment_id, user_id)
          );
        `),
      )
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS comment_upvotes_comment_idx ON comment_upvotes(comment_id)",
        ),
      )
      .then(() => undefined);
  }
  await schemaReady;
}

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    postKey: row.post_key,
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? "",
    text: row.text,
    createdAt: row.created_at,
    upvotes: Number(row.upvotes) || 0,
    viewerUpvoted: Boolean(row.viewer_upvoted),
  };
}

export async function listComments(input: {
  postKey: string;
  viewerUserId: string;
}): Promise<Comment[]> {
  const postKey = input.postKey;

  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<CommentRow>(
      `SELECT c.id, c.post_key, c.user_id, c.text, c.created_at,
        u.display_name, u.avatar_url,
        (SELECT COUNT(*) FROM comment_upvotes cu WHERE cu.comment_id = c.id) as upvotes,
        (SELECT COUNT(*) FROM comment_upvotes cu WHERE cu.comment_id = c.id AND cu.user_id = $2) as viewer_upvoted
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_key = $1
       ORDER BY upvotes DESC, c.created_at DESC
       LIMIT 100`,
      [postKey, input.viewerUserId],
    );
    return result.rows.map(toComment);
  }

  const rows = db
    .prepare(
      `SELECT c.id, c.post_key, c.user_id, c.text, c.created_at,
        u.display_name as display_name,
        u.avatar_url as avatar_url,
        (SELECT COUNT(*) FROM comment_upvotes cu WHERE cu.comment_id = c.id) as upvotes,
        (SELECT COUNT(*) FROM comment_upvotes cu WHERE cu.comment_id = c.id AND cu.user_id = ?) as viewer_upvoted
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_key = ?
       ORDER BY upvotes DESC, c.created_at DESC
       LIMIT 100`,
    )
    .all(input.viewerUserId, postKey) as unknown as CommentRow[];

  return rows.map(toComment);
}

export async function createComment(input: {
  postKey: string;
  userId: string;
  text: string;
}): Promise<void> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const text = input.text.trim().slice(0, 500);
  if (text.length < 1) return;

  if (postgresPool) {
    await ensureSchema();
    await postgresPool.query(
      `INSERT INTO comments (id, post_key, user_id, text, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, input.postKey, input.userId, text, createdAt],
    );
    return;
  }

  db.prepare(
    `INSERT INTO comments (id, post_key, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, input.postKey, input.userId, text, createdAt);
}

export async function toggleUpvote(input: {
  commentId: string;
  userId: string;
}): Promise<void> {
  const createdAt = new Date().toISOString();
  if (postgresPool) {
    await ensureSchema();
    const del = await postgresPool.query(
      `DELETE FROM comment_upvotes WHERE comment_id = $1 AND user_id = $2`,
      [input.commentId, input.userId],
    );
    if ((del.rowCount ?? 0) > 0) return;
    await postgresPool.query(
      `INSERT INTO comment_upvotes (comment_id, user_id, created_at) VALUES ($1, $2, $3)`,
      [input.commentId, input.userId, createdAt],
    );
    return;
  }

  const del = db
    .prepare(`DELETE FROM comment_upvotes WHERE comment_id = ? AND user_id = ?`)
    .run(input.commentId, input.userId);
  if (del.changes > 0) return;
  db.prepare(
    `INSERT INTO comment_upvotes (comment_id, user_id, created_at) VALUES (?, ?, ?)`,
  ).run(input.commentId, input.userId, createdAt);
}

