import "server-only";

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { db } from "@/lib/db";
import { isMarketExpired, parseMarketEndsAtMs } from "@/lib/markets/market-status";

export type Market = {
  id: string;
  question: string;
  category: string;
  subcategory: string;
  hashtags: string[];
  endsAt: string;
  resolvedSide: MarketSide | null;
  resolvedAt: string | null;
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
          subcategory TEXT,
          hashtags_json TEXT,
          ends_at TEXT NOT NULL,
          resolved_side TEXT,
          resolved_at TEXT,
          created_at TEXT NOT NULL,
          source TEXT NOT NULL,
          yes_probability REAL NOT NULL,
          no_probability REAL NOT NULL,
          volume_cents INTEGER NOT NULL DEFAULT 0
        );
      `)
      .then(() =>
        postgresPool.query(
          "ALTER TABLE markets ADD COLUMN IF NOT EXISTS subcategory TEXT",
        ),
      )
      .then(() =>
        postgresPool.query(
          "ALTER TABLE markets ADD COLUMN IF NOT EXISTS hashtags_json TEXT",
        ),
      )
      .then(() =>
        postgresPool.query(
          "ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolved_side TEXT",
        ),
      )
      .then(() =>
        postgresPool.query(
          "ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolved_at TEXT",
        ),
      )
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
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS markets_category_subcategory_created_at_idx ON markets(category, subcategory, created_at DESC)",
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
            created_at TEXT NOT NULL,
            settled_at TEXT,
            payout_cents INTEGER NOT NULL DEFAULT 0
          );
        `),
      )
      .then(() =>
        postgresPool.query(
          "ALTER TABLE market_trades ADD COLUMN IF NOT EXISTS settled_at TEXT",
        ),
      )
      .then(() =>
        postgresPool.query(
          "ALTER TABLE market_trades ADD COLUMN IF NOT EXISTS payout_cents INTEGER NOT NULL DEFAULT 0",
        ),
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
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS market_trades_market_settled_idx ON market_trades(market_id, settled_at)",
        ),
      )
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS markets_unresolved_ends_at_idx ON markets(ends_at) WHERE resolved_side IS NULL",
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
  subcategory: string | null;
  hashtags_json: string | null;
  ends_at: string;
  resolved_side: string | null;
  resolved_at: string | null;
  created_at: string;
  source: string;
  yes_probability: number;
  no_probability: number;
  volume_cents: number;
}): Market {
  let hashtags: string[] = [];
  const raw = row.hashtags_json ?? "";
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        hashtags = parsed.filter((t) => typeof t === "string").slice(0, 8) as string[];
      }
    } catch {
      // ignore
    }
  }
  return {
    id: row.id,
    question: row.question,
    category: row.category,
    subcategory: row.subcategory ?? "",
    hashtags,
    endsAt: row.ends_at,
    resolvedSide:
      row.resolved_side === "yes" || row.resolved_side === "no"
        ? (row.resolved_side as MarketSide)
        : null,
    resolvedAt: row.resolved_at ?? null,
    createdAt: row.created_at,
    source: row.source,
    yesProbability: Number(row.yes_probability),
    noProbability: Number(row.no_probability),
    volumeCents: Number(row.volume_cents ?? 0),
  };
}

/** Oldest-visible row anchor for paging (strictly older results after this tuple). */
export type MarketCursor = { createdAt: string; id: string };

/** Postgres / SQLite `markets` row shape (see `rowToMarket`). */
type MarketDbRow = {
  id: string;
  question: string;
  category: string;
  subcategory: string | null;
  hashtags_json: string | null;
  ends_at: string;
  resolved_side: string | null;
  resolved_at: string | null;
  created_at: string;
  source: string;
  yes_probability: number;
  no_probability: number;
  volume_cents: number;
};

function cursorPredicateSqlite(cursor: MarketCursor): string {
  return "(created_at < ? OR (created_at = ? AND id < ?))";
}

/** Params for SQLite cursor binds: [ ..., ca, ca, id ] appended after WHERE prefix params. */
function cursorBind(cursor: MarketCursor): [string, string, string] {
  return [cursor.createdAt, cursor.createdAt, cursor.id];
}

export async function listMarkets(input: {
  limit: number;
  category?: string;
  subcategory?: string;
  cursor?: MarketCursor;
}): Promise<Market[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(input.limit)));
  const category =
    typeof input.category === "string" && input.category.trim()
      ? input.category.trim().slice(0, 24)
      : "";
  const subcategory =
    typeof input.subcategory === "string" && input.subcategory.trim()
      ? input.subcategory.trim().slice(0, 32)
      : "";
  const cur = input.cursor;
  const hasCur = !!(cur?.createdAt && cur?.id);
  const cursorTailSqlite = hasCur ? ` AND ${cursorPredicateSqlite(cur!)}` : "";

  if (postgresPool) {
    await ensureSchema();
    if (category && subcategory) {
      const sql = !hasCur
        ? `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
         FROM markets
         WHERE category = $2 AND subcategory = $3
         ORDER BY created_at DESC, id DESC
         LIMIT $1`
        : `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
         FROM markets
         WHERE category = $2 AND subcategory = $3
         AND (created_at < $4::text OR (created_at = $4::text AND id < $5::text))
         ORDER BY created_at DESC, id DESC
         LIMIT $1`;
      const params = hasCur ? [limit, category, subcategory, cur!.createdAt, cur!.id] : [limit, category, subcategory];
      const result = await postgresPool.query<MarketDbRow>(sql, params);
      return result.rows.map(rowToMarket);
    }
    if (category) {
      const sql = !hasCur
        ? `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
         FROM markets
         WHERE category = $2
         ORDER BY created_at DESC, id DESC
         LIMIT $1`
        : `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
         FROM markets
         WHERE category = $2
         AND (created_at < $3::text OR (created_at = $3::text AND id < $4::text))
         ORDER BY created_at DESC, id DESC
         LIMIT $1`;
      const params = hasCur ? [limit, category, cur!.createdAt, cur!.id] : [limit, category];
      const result = await postgresPool.query<MarketDbRow>(sql, params);
      return result.rows.map(rowToMarket);
    }
    if (subcategory) {
      const sql = !hasCur
        ? `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
         FROM markets
         WHERE subcategory = $2
         ORDER BY created_at DESC, id DESC
         LIMIT $1`
        : `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
         FROM markets
         WHERE subcategory = $2
         AND (created_at < $3::text OR (created_at = $3::text AND id < $4::text))
         ORDER BY created_at DESC, id DESC
         LIMIT $1`;
      const params = hasCur ? [limit, subcategory, cur!.createdAt, cur!.id] : [limit, subcategory];
      const result = await postgresPool.query<MarketDbRow>(sql, params);
      return result.rows.map(rowToMarket);
    }
    const sql = !hasCur
      ? `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
       FROM markets
       ORDER BY created_at DESC, id DESC
       LIMIT $1`
      : `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
       FROM markets
       WHERE (created_at < $2::text OR (created_at = $2::text AND id < $3::text))
       ORDER BY created_at DESC, id DESC
       LIMIT $1`;
    const params = hasCur ? [limit, cur!.createdAt, cur!.id] : [limit];
    const result = await postgresPool.query<MarketDbRow>(sql, params);
    return result.rows.map(rowToMarket);
  }

  /** Split branches so Turbopack never sees tricky `}>;` casts on nested ternaries. */
  let rowsRaw: MarketDbRow[];
  if (category && subcategory) {
    rowsRaw = db
      .prepare(
        `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
           FROM markets
           WHERE category = ? AND subcategory = ? ${hasCur ? cursorTailSqlite : ""}
           ORDER BY created_at DESC, id DESC
           LIMIT ?`,
      )
      .all(
        ...(hasCur
          ? [category, subcategory, ...cursorBind(cur!), limit]
          : [category, subcategory, limit]),
      ) as MarketDbRow[];
  } else if (category) {
    rowsRaw = db
      .prepare(
        `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
             FROM markets
             WHERE category = ? ${hasCur ? cursorTailSqlite : ""}
             ORDER BY created_at DESC, id DESC
             LIMIT ?`,
      )
      .all(...(hasCur ? [category, ...cursorBind(cur!), limit] : [category, limit])) as MarketDbRow[];
  } else if (subcategory) {
    rowsRaw = db
      .prepare(
        `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
             FROM markets
             WHERE subcategory = ? ${hasCur ? cursorTailSqlite : ""}
             ORDER BY created_at DESC, id DESC
             LIMIT ?`,
      )
      .all(...(hasCur ? [subcategory, ...cursorBind(cur!), limit] : [subcategory, limit])) as MarketDbRow[];
  } else {
    rowsRaw = db
      .prepare(
        `SELECT id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents
           FROM markets
           ${hasCur ? `WHERE ${cursorPredicateSqlite(cur!)}` : ""}
           ORDER BY created_at DESC, id DESC
           LIMIT ?`,
      )
      .all(...(hasCur ? [...cursorBind(cur!), limit] : [limit])) as MarketDbRow[];
  }

  return rowsRaw.map(rowToMarket);
}

const PEAK_AI_MARKET_SOURCE_SQL = `source NOT LIKE 'peak_post:%' AND source != 'pending'`;

/** Markets published by Peak AI (cron + feed autogen), not user peak listings. */
export async function listPeakAiMarkets(input: { limit?: number } = {}): Promise<Market[]> {
  const limit = Math.max(1, Math.min(200, Math.floor(input.limit ?? 200)));
  const selectCols =
    "id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents";

  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<MarketDbRow>(
      `SELECT ${selectCols}
       FROM markets
       WHERE ${PEAK_AI_MARKET_SOURCE_SQL}
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows.map(rowToMarket);
  }

  const rows = db
    .prepare(
      `SELECT ${selectCols}
       FROM markets
       WHERE source NOT LIKE 'peak_post:%' AND source != 'pending'
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(limit) as MarketDbRow[];

  return rows.map(rowToMarket);
}

export async function getMarketById(id: string): Promise<Market | null> {
  const marketId = id.trim();
  if (!marketId) return null;
  const selectCols =
    "id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents";

  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<MarketDbRow>(
      `SELECT ${selectCols} FROM markets WHERE id = $1 LIMIT 1`,
      [marketId],
    );
    const row = result.rows[0];
    return row ? rowToMarket(row) : null;
  }

  const row = db
    .prepare(`SELECT ${selectCols} FROM markets WHERE id = ? LIMIT 1`)
    .get(marketId) as MarketDbRow | undefined;
  return row ? rowToMarket(row) : null;
}

export async function createMarket(input: {
  question: string;
  category: string;
  subcategory?: string;
  hashtags?: string[];
  endsAt: string;
  source: string;
  yesProbability: number;
}): Promise<Market> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const yesP = clampProbability(input.yesProbability);
  const noP = clampProbability(1 - yesP);
  const subcategory =
    typeof input.subcategory === "string" ? input.subcategory.trim().slice(0, 32) : "";
  const hashtagsJson =
    Array.isArray(input.hashtags) && input.hashtags.length
      ? JSON.stringify(
          input.hashtags
            .filter((t) => typeof t === "string")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8),
        )
      : "";

  if (postgresPool) {
    await ensureSchema();
    await postgresPool.query(
      `INSERT INTO markets (id, question, category, subcategory, hashtags_json, ends_at, created_at, source, yes_probability, no_probability, volume_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0)`,
      [
        id,
        input.question,
        input.category,
        subcategory || null,
        hashtagsJson || null,
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
      subcategory,
      hashtags: hashtagsJson ? (JSON.parse(hashtagsJson) as string[]) : [],
      endsAt: input.endsAt,
      resolvedSide: null,
      resolvedAt: null,
      createdAt,
      source: input.source,
      yesProbability: yesP,
      noProbability: noP,
      volumeCents: 0,
    };
  }

  db.prepare(
    `INSERT INTO markets (id, question, category, subcategory, hashtags_json, ends_at, created_at, source, yes_probability, no_probability, volume_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(
    id,
    input.question,
    input.category,
    subcategory || null,
    hashtagsJson || null,
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
    subcategory,
    hashtags: hashtagsJson ? (JSON.parse(hashtagsJson) as string[]) : [],
    endsAt: input.endsAt,
    resolvedSide: null,
    resolvedAt: null,
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

const PEAK_POST_SOURCE_PREFIX = "peak_post:";

export function peakIdFromMarketSource(source: string): string | null {
  if (!source.startsWith(PEAK_POST_SOURCE_PREFIX)) return null;
  const id = source.slice(PEAK_POST_SOURCE_PREFIX.length).trim();
  return id || null;
}

/** Unresolved markets whose ISO `ends_at` is in the past (for auto-resolve cron). */
export async function listMarketsDueForResolution(input: {
  limit: number;
  nowMs?: number;
}): Promise<Market[]> {
  const limit = Math.max(1, Math.min(50, Math.floor(input.limit)));
  const nowIso = new Date(input.nowMs ?? Date.now()).toISOString();
  const selectCols =
    "id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents";

  let rows: MarketDbRow[] = [];
  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<MarketDbRow>(
      `SELECT ${selectCols}
       FROM markets
       WHERE resolved_side IS NULL AND ends_at <= $1
       ORDER BY ends_at ASC
       LIMIT $2`,
      [nowIso, limit * 3],
    );
    rows = result.rows;
  } else {
    rows = db
      .prepare(
        `SELECT ${selectCols}
         FROM markets
         WHERE resolved_side IS NULL AND ends_at <= ?
         ORDER BY ends_at ASC
         LIMIT ?`,
      )
      .all(nowIso, limit * 3) as MarketDbRow[];
  }

  return rows
    .map(rowToMarket)
    .filter((m) => parseMarketEndsAtMs(m.endsAt) !== null && isMarketExpired(m.endsAt, input.nowMs))
    .slice(0, limit);
}

export async function listMarketsByPeakIds(peakIds: string[]): Promise<Map<string, Market>> {
  const unique = [...new Set(peakIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, Market>();
  if (unique.length === 0) return out;

  const sources = unique.map((id) => `${PEAK_POST_SOURCE_PREFIX}${id}`);
  const selectCols =
    "id, question, category, subcategory, hashtags_json, ends_at, resolved_side, resolved_at, created_at, source, yes_probability, no_probability, volume_cents";

  if (postgresPool) {
    await ensureSchema();
    const placeholders = sources.map((_, i) => `$${i + 1}`).join(", ");
    const result = await postgresPool.query<MarketDbRow>(
      `SELECT ${selectCols} FROM markets WHERE source IN (${placeholders})`,
      sources,
    );
    for (const row of result.rows) {
      const peakId = peakIdFromMarketSource(row.source);
      if (peakId) out.set(peakId, rowToMarket(row));
    }
    return out;
  }

  const placeholders = sources.map(() => "?").join(", ");
  const rows = db
    .prepare(`SELECT ${selectCols} FROM markets WHERE source IN (${placeholders})`)
    .all(...sources) as MarketDbRow[];

  for (const row of rows) {
    const peakId = peakIdFromMarketSource(row.source);
    if (peakId) out.set(peakId, rowToMarket(row));
  }
  return out;
}

