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
        CREATE TABLE IF NOT EXISTS market_share_images (
          market_id TEXT PRIMARY KEY,
          image_png BYTEA NOT NULL,
          updated_at TEXT NOT NULL
        );
      `)
      .then(() => undefined);
  }
  await schemaReady;
}

function ensureSqliteSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS market_share_images (
      market_id TEXT PRIMARY KEY,
      image_png BLOB NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export async function getMarketShareImage(marketId: string): Promise<Buffer | null> {
  const id = marketId.trim();
  if (!id) return null;

  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<{ image_png: Buffer }>(
      `SELECT image_png FROM market_share_images WHERE market_id = $1 LIMIT 1`,
      [id],
    );
    const row = result.rows[0];
    return row?.image_png?.length ? row.image_png : null;
  }

  ensureSqliteSchema();
  const row = db
    .prepare(`SELECT image_png FROM market_share_images WHERE market_id = ? LIMIT 1`)
    .get(id) as { image_png: Buffer } | undefined;
  return row?.image_png?.length ? row.image_png : null;
}

export async function upsertMarketShareImage(marketId: string, png: Buffer): Promise<void> {
  const id = marketId.trim();
  if (!id || !png.length) return;
  const updatedAt = new Date().toISOString();

  if (postgresPool) {
    await ensureSchema();
    await postgresPool.query(
      `INSERT INTO market_share_images (market_id, image_png, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (market_id) DO UPDATE SET image_png = EXCLUDED.image_png, updated_at = EXCLUDED.updated_at`,
      [id, png, updatedAt],
    );
    return;
  }

  ensureSqliteSchema();
  db.prepare(
    `INSERT INTO market_share_images (market_id, image_png, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(market_id) DO UPDATE SET image_png = excluded.image_png, updated_at = excluded.updated_at`,
  ).run(id, png, updatedAt);
}
