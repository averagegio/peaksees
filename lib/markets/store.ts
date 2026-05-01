import "server-only";

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { db } from "@/lib/db";

export type Market = {
  id: string;
  question: string;
  category: string;
  endsAt: string;
  createdAt: string;
  source: string;
  yesProbability: number;
  noProbability: number;
  volumeCents: number;
};

export type MarketSide = "yes" | "no";

export type MarketTrade = {
  id: string;
  userId: string;
  marketId: string;
  side: MarketSide;
  priceCents: number;
  sharesX1000: number;
  costCents: number;
  createdAt: string;
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
        CREATE TABLE IF NOT EXISTS markets (
          id TEXT PRIMARY KEY,
          question TEXT NOT NULL,
          category TEXT NOT NULL,
          ends_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          source TEXT NOT NULL,
          yes_probability REAL NOT NULL,
          no_probability REAL NOT NULL,
          volume_cents INTEGER NOT NULL DEFAULT 0
        );
      `)
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS markets_created_at_idx ON markets(created_at DESC)",
        ),
      )
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS markets_category_created_at_idx ON markets(category, created_at DESC)",
        ),
      )
      .then(() =>
        postgresPool.query(`
          CREATE TABLE IF NOT EXISTS market_trades (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            market_id TEXT NOT NULL,
            side TEXT NOT NULL,
            price_cents INTEGER NOT NULL,
            shares_x1000 INTEGER NOT NULL,
            cost_cents INTEGER NOT NULL,
            created_at TEXT NOT NULL
          );
        `),
      )
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS market_trades_user_created_at_idx ON market_trades(user_id, created_at DESC)",
        ),
      )
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS market_trades_market_created_at_idx ON market_trades(market_id, created_at DESC)",
        ),
      )
      .then(() => undefined);
  }
  await schemaReady;
}

function rowToMarket(row: {
  id: string;
  question: string;
  category: string;
  ends_at: string;
  created_at: string;
  source: string;
  yes_probability: number;
  no_probability: number;
  volume_cents: number;
}): Market {
  return {
    id: row.id,
    question: row.question,
    category: row.category,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    source: row.source,
    yesProbability: Number(row.yes_probability),
    noProbability: Number(row.no_probability),
    volumeCents: Number(row.volume_cents ?? 0),
  };
}

export async function listMarkets(input: {
  limit: number;
  category?: string;
}): Promise<Market[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(input.limit)));
  const category =
    typeof input.category === "string" && input.category.trim()
      ? input.category.trim().slice(0, 24)
      : "";
  if (postgresPool) {
    await ensureSchema();
    if (category) {
      const result = await postgresPool.query<{
        id: string;
        question: string;
        category: string;
        ends_at: string;
        created_at: string;
        source: string;
        yes_probability: number;
        no_probability: number;
        volume_cents: number;
      }>(
        `SELECT id, question, category, ends_at, created_at, source, yes_probability, no_probability, volume_cents
         FROM markets
         WHERE category = $2
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit, category],
      );
      return result.rows.map(rowToMarket);
    }
    const result = await postgresPool.query<{
      id: string;
      question: string;
      category: string;
      ends_at: string;
      created_at: string;
      source: string;
      yes_probability: number;
      no_probability: number;
      volume_cents: number;
    }>(
      `SELECT id, question, category, ends_at, created_at, source, yes_probability, no_probability, volume_cents
       FROM markets
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(rowToMarket);
  }

  const rows = (category
    ? db
        .prepare(
          `SELECT id, question, category, ends_at, created_at, source, yes_probability, no_probability, volume_cents
           FROM markets
           WHERE category = ?
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(category, limit)
    : db
        .prepare(
          `SELECT id, question, category, ends_at, created_at, source, yes_probability, no_probability, volume_cents
           FROM markets
           ORDER BY created_at DESC
           LIMIT ?`,
        )
        .all(limit)) as Array<{
    id: string;
    question: string;
    category: string;
    ends_at: string;
    created_at: string;
    source: string;
    yes_probability: number;
    no_probability: number;
    volume_cents: number;
  }>;
  return rows.map(rowToMarket);
}

export async function createMarket(input: {
  question: string;
  category: string;
  endsAt: string;
  source: string;
  yesProbability: number;
}): Promise<Market> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const yesP = clampProbability(input.yesProbability);
  const noP = clampProbability(1 - yesP);

  if (postgresPool) {
    await ensureSchema();
    await postgresPool.query(
      `INSERT INTO markets (id, question, category, ends_at, created_at, source, yes_probability, no_probability, volume_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0)`,
      [
        id,
        input.question,
        input.category,
        input.endsAt,
        createdAt,
        input.source,
        yesP,
        noP,
      ],
    );
    return {
      id,
      question: input.question,
      category: input.category,
      endsAt: input.endsAt,
      createdAt,
      source: input.source,
      yesProbability: yesP,
      noProbability: noP,
      volumeCents: 0,
    };
  }

  db.prepare(
    `INSERT INTO markets (id, question, category, ends_at, created_at, source, yes_probability, no_probability, volume_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(
    id,
    input.question,
    input.category,
    input.endsAt,
    createdAt,
    input.source,
    yesP,
    noP,
  );

  return {
    id,
    question: input.question,
    category: input.category,
    endsAt: input.endsAt,
    createdAt,
    source: input.source,
    yesProbability: yesP,
    noProbability: noP,
    volumeCents: 0,
  };
}

function clampProbability(p: number) {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(0.99, Math.max(0.01, p));
}

