import "server-only";

import { Pool } from "pg";

import { db } from "@/lib/db";

export type PeakstatsRow = {
  userId: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  balanceCents: number;
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
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL,
          bio TEXT,
          avatar_url TEXT,
          banner_url TEXT
        );
      `)
      .then(() =>
        postgresPool.query(`
          CREATE TABLE IF NOT EXISTS peakpoints_ledger (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            note TEXT
          );
        `),
      )
      .then(() => undefined);
  }
  await schemaReady;
}

export async function listPeakstatsLeaderboard(input: {
  limit: number;
}): Promise<PeakstatsRow[]> {
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit)));

  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<{
      user_id: string;
      email: string;
      display_name: string;
      avatar_url: string | null;
      balance_cents: string | null;
    }>(
      `
      SELECT
        u.id as user_id,
        u.email as email,
        u.display_name as display_name,
        u.avatar_url as avatar_url,
        COALESCE(SUM(l.amount_cents), 0)::text as balance_cents
      FROM users u
      LEFT JOIN peakpoints_ledger l ON l.user_id = u.id
      GROUP BY u.id, u.email, u.display_name, u.avatar_url
      ORDER BY COALESCE(SUM(l.amount_cents), 0) DESC
      LIMIT $1
      `,
      [limit],
    );
    return result.rows.map((r) => ({
      userId: r.user_id,
      email: r.email,
      displayName: r.display_name,
      avatarUrl: r.avatar_url ?? "",
      balanceCents: Number(r.balance_cents ?? 0),
    }));
  }

  const rows = db
    .prepare(
      `
      SELECT
        u.id as user_id,
        u.email as email,
        u.display_name as display_name,
        u.avatar_url as avatar_url,
        COALESCE(SUM(l.amount_cents), 0) as balance_cents
      FROM users u
      LEFT JOIN peakpoints_ledger l ON l.user_id = u.id
      GROUP BY u.id, u.email, u.display_name, u.avatar_url
      ORDER BY COALESCE(SUM(l.amount_cents), 0) DESC
      LIMIT ?
      `,
    )
    .all(limit) as Array<{
    user_id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    balance_cents: number;
  }>;

  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    avatarUrl: r.avatar_url ?? "",
    balanceCents: Number(r.balance_cents ?? 0),
  }));
}

