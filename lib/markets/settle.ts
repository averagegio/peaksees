import "server-only";

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { db } from "@/lib/db";
import type { MarketSide } from "@/lib/markets/store";

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
      .query(
        "ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolved_side TEXT",
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
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS market_trades_market_settled_idx ON market_trades(market_id, settled_at)",
        ),
      )
      .then(() => undefined);
  }
  await schemaReady;
}

function payoutCentsFromSharesX1000(sharesX1000: number) {
  // 1 share pays $1.00 => 100 cents.
  // sharesX1000 stores shares * 1000.
  return Math.max(0, Math.floor((sharesX1000 * 100) / 1000));
}

export async function resolveAndSettleMarket(input: {
  marketId: string;
  outcome: MarketSide; // yes | no
}): Promise<{
  marketId: string;
  outcome: MarketSide;
  resolvedAt: string;
  settledTrades: number;
  totalPayoutCents: number;
}> {
  const marketId = input.marketId.trim();
  if (!marketId) throw new Error("marketId required");
  const outcome = input.outcome;
  if (outcome !== "yes" && outcome !== "no") throw new Error("outcome must be yes|no");

  const resolvedAt = new Date().toISOString();

  if (postgresPool) {
    await ensureSchema();
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");

      const mRes = await client.query<{ resolved_side: string | null }>(
        `SELECT resolved_side FROM markets WHERE id = $1 FOR UPDATE`,
        [marketId],
      );
      if (!mRes.rows[0]) throw new Error("Market not found");
      if (mRes.rows[0].resolved_side) throw new Error("Market already resolved");

      await client.query(
        `UPDATE markets SET resolved_side = $2, resolved_at = $3 WHERE id = $1`,
        [marketId, outcome, resolvedAt],
      );

      const tradesRes = await client.query<{
        id: string;
        user_id: string;
        side: string;
        shares_x1000: number;
      }>(
        `SELECT id, user_id, side, shares_x1000
         FROM market_trades
         WHERE market_id = $1 AND settled_at IS NULL
         FOR UPDATE`,
        [marketId],
      );

      let totalPayoutCents = 0;
      let settledTrades = 0;
      for (const tr of tradesRes.rows) {
        const tradeSide = tr.side === "yes" || tr.side === "no" ? tr.side : null;
        if (!tradeSide) continue;
        const payoutCents =
          tradeSide === outcome ? payoutCentsFromSharesX1000(Number(tr.shares_x1000)) : 0;
        if (payoutCents > 0) {
          await client.query(
            `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              randomUUID(),
              tr.user_id,
              "reward",
              payoutCents,
              resolvedAt,
              `Settlement payout for market ${marketId} (${outcome.toUpperCase()})`,
            ],
          );
          totalPayoutCents += payoutCents;
        }
        await client.query(
          `UPDATE market_trades
           SET settled_at = $2, payout_cents = $3
           WHERE id = $1`,
          [tr.id, resolvedAt, payoutCents],
        );
        settledTrades += 1;
      }

      await client.query("COMMIT");
      return { marketId, outcome, resolvedAt, settledTrades, totalPayoutCents };
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }

  // SQLite
  const tx = db.transaction(() => {
    const m = db
      .prepare(`SELECT resolved_side FROM markets WHERE id = ?`)
      .get(marketId) as { resolved_side: string | null } | undefined;
    if (!m) throw new Error("Market not found");
    if (m.resolved_side) throw new Error("Market already resolved");

    db.prepare(`UPDATE markets SET resolved_side = ?, resolved_at = ? WHERE id = ?`).run(
      outcome,
      resolvedAt,
      marketId,
    );

    const trades = db
      .prepare(
        `SELECT id, user_id, side, shares_x1000
         FROM market_trades
         WHERE market_id = ? AND settled_at IS NULL`,
      )
      .all(marketId) as Array<{
      id: string;
      user_id: string;
      side: string;
      shares_x1000: number;
    }>;

    let totalPayoutCents = 0;
    let settledTrades = 0;
    for (const tr of trades) {
      const tradeSide = tr.side === "yes" || tr.side === "no" ? tr.side : null;
      if (!tradeSide) continue;
      const payoutCents =
        tradeSide === outcome ? payoutCentsFromSharesX1000(Number(tr.shares_x1000)) : 0;
      if (payoutCents > 0) {
        db.prepare(
          `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          randomUUID(),
          tr.user_id,
          "reward",
          payoutCents,
          resolvedAt,
          `Settlement payout for market ${marketId} (${outcome.toUpperCase()})`,
        );
        totalPayoutCents += payoutCents;
      }
      db.prepare(
        `UPDATE market_trades SET settled_at = ?, payout_cents = ? WHERE id = ?`,
      ).run(resolvedAt, payoutCents, tr.id);
      settledTrades += 1;
    }

    return { totalPayoutCents, settledTrades };
  });

  const { totalPayoutCents, settledTrades } = tx();
  return { marketId, outcome, resolvedAt, settledTrades, totalPayoutCents };
}

