import "server-only";

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import {
  MARKET_FEED_FOLLOWING,
  MARKET_FEED_FOR_YOU,
  MARKET_FEED_LIVE,
} from "@/app/lib/mock-markets";
import { db } from "@/lib/db";

export type TradeSide = "yes" | "no";

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
          "ALTER TABLE market_trades ADD COLUMN IF NOT EXISTS settled_at TEXT",
        ),
      )
      .then(() =>
        postgresPool.query(
          "ALTER TABLE market_trades ADD COLUMN IF NOT EXISTS payout_cents INTEGER NOT NULL DEFAULT 0",
        ),
      )
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
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS peakpoints_ledger_user_idx ON peakpoints_ledger(user_id, created_at DESC)",
        ),
      )
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS market_trades_market_settled_idx ON market_trades(market_id, settled_at)",
        ),
      )
      .then(() => undefined);
  }
  await schemaReady;
}

export async function getPeakpointsBalanceCents(userId: string): Promise<number> {
  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<{ s: string | null }>(
      `SELECT COALESCE(SUM(amount_cents), 0) as s FROM peakpoints_ledger WHERE user_id = $1`,
      [userId],
    );
    return Number(result.rows[0]?.s ?? 0);
  }
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) as s FROM peakpoints_ledger WHERE user_id = ?`,
    )
    .get(userId) as { s: number };
  return Number(row?.s ?? 0);
}

export async function buyMarketSide(input: {
  userId: string;
  marketId: string;
  side: TradeSide;
  amountCents: number;
}): Promise<{
  trade: {
    id: string;
    marketId: string;
    side: TradeSide;
    priceCents: number;
    sharesX1000: number;
    costCents: number;
    createdAt: string;
  };
}> {
  const amountCents = Math.floor(Number(input.amountCents));
  if (!Number.isFinite(amountCents) || amountCents < 100) {
    throw new Error("amountCents must be >= 100");
  }

  if (postgresPool) {
    await ensureSchema();
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");

      const mRes = await client.query<{
        id: string;
        question: string;
        yes_probability: number;
        no_probability: number;
      }>(
        `SELECT id, question, yes_probability, no_probability
         FROM markets
         WHERE id = $1
         FOR UPDATE`,
        [input.marketId],
      );
      let m = mRes.rows[0];
      if (!m) {
        const seeded = seedFromMock(input.marketId);
        if (!seeded) throw new Error("Market not found");
        await client.query(
          `INSERT INTO markets (id, question, category, ends_at, created_at, source, yes_probability, no_probability, volume_cents)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0)`,
          [
            seeded.id,
            seeded.question,
            seeded.category,
            seeded.endsAt,
            new Date().toISOString(),
            "seed_mock",
            seeded.yesProbability,
            seeded.noProbability,
          ],
        );
        m = {
          id: seeded.id,
          question: seeded.question,
          yes_probability: seeded.yesProbability,
          no_probability: seeded.noProbability,
        };
      }

      const p =
        input.side === "yes" ? Number(m.yes_probability) : Number(m.no_probability);
      const priceCents = clampPriceCents(Math.round(p * 100));
      const sharesX1000 = Math.max(1, Math.floor((amountCents * 1000) / priceCents));
      const costCents = Math.floor((sharesX1000 * priceCents) / 1000);

      const balRes = await client.query<{ s: string | null }>(
        `SELECT COALESCE(SUM(amount_cents), 0) as s FROM peakpoints_ledger WHERE user_id = $1`,
        [input.userId],
      );
      const bal = Number(balRes.rows[0]?.s ?? 0);
      if (bal < costCents) throw new Error("Insufficient Peakpoints balance");

      const tradeId = randomUUID();
      const ledgerId = randomUUID();
      const createdAt = new Date().toISOString();

      await client.query(
        `INSERT INTO market_trades (id, user_id, market_id, side, price_cents, shares_x1000, cost_cents, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          tradeId,
          input.userId,
          input.marketId,
          input.side,
          priceCents,
          sharesX1000,
          costCents,
          createdAt,
        ],
      );

      await client.query(
        `UPDATE markets SET volume_cents = volume_cents + $1 WHERE id = $2`,
        [costCents, input.marketId],
      );

      await client.query(
        `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          ledgerId,
          input.userId,
          "spend",
          -costCents,
          createdAt,
          `Trade ${input.side.toUpperCase()} on market: ${m.question.slice(0, 80)}`,
        ],
      );

      await client.query("COMMIT");
      return {
        trade: {
          id: tradeId,
          marketId: input.marketId,
          side: input.side,
          priceCents,
          sharesX1000,
          costCents,
          createdAt,
        },
      };
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  // SQLite
  let market = db
    .prepare(
      `SELECT id, question, yes_probability, no_probability
       FROM markets
       WHERE id = ?`,
    )
    .get(input.marketId) as
    | { id: string; question: string; yes_probability: number; no_probability: number }
    | undefined;
  if (!market) {
    const seeded = seedFromMock(input.marketId);
    if (!seeded) throw new Error("Market not found");
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO markets (id, question, category, ends_at, created_at, source, yes_probability, no_probability, volume_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    ).run(
      seeded.id,
      seeded.question,
      seeded.category,
      seeded.endsAt,
      createdAt,
      "seed_mock",
      seeded.yesProbability,
      seeded.noProbability,
    );
    market = {
      id: seeded.id,
      question: seeded.question,
      yes_probability: seeded.yesProbability,
      no_probability: seeded.noProbability,
    };
  }

  const p =
    input.side === "yes"
      ? Number(market.yes_probability)
      : Number(market.no_probability);
  const priceCents = clampPriceCents(Math.round(p * 100));
  const sharesX1000 = Math.max(1, Math.floor((amountCents * 1000) / priceCents));
  const costCents = Math.floor((sharesX1000 * priceCents) / 1000);

  const bal = await getPeakpointsBalanceCents(input.userId);
  if (bal < costCents) throw new Error("Insufficient Peakpoints balance");

  const tradeId = randomUUID();
  const ledgerId = randomUUID();
  const createdAt = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO market_trades (id, user_id, market_id, side, price_cents, shares_x1000, cost_cents, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      tradeId,
      input.userId,
      input.marketId,
      input.side,
      priceCents,
      sharesX1000,
      costCents,
      createdAt,
    );

    db.prepare(`UPDATE markets SET volume_cents = volume_cents + ? WHERE id = ?`).run(
      costCents,
      input.marketId,
    );

    db.prepare(
      `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      ledgerId,
      input.userId,
      "spend",
      -costCents,
      createdAt,
      `Trade ${input.side.toUpperCase()} on market: ${market.question.slice(0, 80)}`,
    );
  });

  tx();

  return {
    trade: {
      id: tradeId,
      marketId: input.marketId,
      side: input.side,
      priceCents,
      sharesX1000,
      costCents,
      createdAt,
    },
  };
}

function clampPriceCents(n: number) {
  if (!Number.isFinite(n)) return 50;
  return Math.min(99, Math.max(1, Math.floor(n)));
}

function seedFromMock(marketId: string): null | {
  id: string;
  question: string;
  category: string;
  endsAt: string;
  yesProbability: number;
  noProbability: number;
} {
  // Allow callers to pass either the raw mock id ("1") or the namespaced one ("market:1").
  const raw = marketId.startsWith("market:") ? marketId.slice("market:".length) : marketId;
  const all = [...MARKET_FEED_FOR_YOU, ...MARKET_FEED_FOLLOWING, ...MARKET_FEED_LIVE];
  const found = all.find((m) => m.id === raw);
  if (!found) return null;
  const yes = found.outcomes.find((o) => o.id === "y")?.probability ?? found.outcomes[0]?.probability ?? 0.5;
  const yesP = Math.min(0.99, Math.max(0.01, Number(yes)));
  return {
    id: `market:${found.id}`,
    question: found.question,
    category: found.category,
    endsAt: found.endsAtLabel,
    yesProbability: yesP,
    noProbability: 1 - yesP,
  };
}

