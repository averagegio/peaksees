import "server-only";

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { db } from "@/lib/db";

export type Peak = {
  id: string;
  userId: string;
  displayName: string;
  handle: string;
  avatarHue: number;
  avatarUrl: string;
  text: string;
  createdAt: string;
};

type PeakRow = {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
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

let peaksSchemaReady: Promise<void> | null = null;
async function ensurePeaksSchema() {
  if (!postgresPool) return;
  if (!peaksSchemaReady) {
    peaksSchemaReady = postgresPool
      .query(`
        CREATE TABLE IF NOT EXISTS peaks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `)
      .then(() => undefined);
  }
  await peaksSchemaReady;
}

function hueForUserId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function toPeak(row: PeakRow): Peak {
  const local = (row.email.split("@")[0] ?? "trader").slice(0, 32);
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    handle: `@${local}`,
    avatarHue: hueForUserId(row.user_id),
    avatarUrl: row.avatar_url ?? "",
    text: row.text,
    createdAt: row.created_at,
  };
}

export async function createPeak(input: {
  userId: string;
  text: string;
}): Promise<Peak> {
  const text = input.text.trim().slice(0, 280);
  const createdAt = new Date().toISOString();
  const id = randomUUID();

  if (postgresPool) {
    await ensurePeaksSchema();
    const result = await postgresPool.query<PeakRow>(
      `INSERT INTO peaks (id, user_id, text, created_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, text, created_at,
         (SELECT display_name FROM users WHERE id = $2) AS display_name,
         (SELECT email FROM users WHERE id = $2) AS email,
         (SELECT avatar_url FROM users WHERE id = $2) AS avatar_url`,
      [id, input.userId, text, createdAt],
    );
    return toPeak(result.rows[0]);
  }

  db.prepare(`INSERT INTO peaks (id, user_id, text, created_at) VALUES (?, ?, ?, ?)`).run(
    id,
    input.userId,
    text,
    createdAt,
  );
  const row = db
    .prepare(
      `SELECT p.id, p.user_id, p.text, p.created_at,
        u.display_name as display_name,
        u.email as email,
        u.avatar_url as avatar_url
       FROM peaks p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = ?
       LIMIT 1`,
    )
    .get(id) as PeakRow;
  return toPeak(row);
}

export async function listPeaks(input: {
  mineUserId?: string;
  limit?: number;
}): Promise<Peak[]> {
  const limit = Math.min(50, Math.max(1, input.limit ?? 20));

  if (postgresPool) {
    await ensurePeaksSchema();
    const params: unknown[] = [];
    let where = "";
    if (input.mineUserId) {
      where = "WHERE p.user_id = $1";
      params.push(input.mineUserId);
    }
    params.push(limit);
    const limitParam = params.length;
    const result = await postgresPool.query<PeakRow>(
      `SELECT p.id, p.user_id, p.text, p.created_at, u.display_name, u.email, u.avatar_url
       FROM peaks p
       JOIN users u ON u.id = p.user_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${limitParam}`,
      params,
    );
    return result.rows.map(toPeak);
  }

  const rows = db
    .prepare(
      `SELECT p.id, p.user_id, p.text, p.created_at,
        u.display_name as display_name,
        u.email as email,
        u.avatar_url as avatar_url
       FROM peaks p
       JOIN users u ON u.id = p.user_id
       ${input.mineUserId ? "WHERE p.user_id = ?" : ""}
       ORDER BY p.created_at DESC
       LIMIT ?`,
    )
    .all(
      ...(input.mineUserId ? [input.mineUserId, limit] : [limit]),
    ) as PeakRow[];

  return rows.map(toPeak);
}
