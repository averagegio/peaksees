import "server-only";

import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { Pool } from "pg";

import { db } from "@/lib/db";

export type EscrowStatus = "held" | "released_win" | "released_loss";

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

export async function ensureEscrowSchema(): Promise<void> {
  if (postgresPool) {
    if (!schemaReady) {
      schemaReady = postgresPool
        .query(`
          CREATE TABLE IF NOT EXISTS market_escrow (
            id TEXT PRIMARY KEY,
            trade_id TEXT NOT NULL UNIQUE,
            user_id TEXT NOT NULL,
            market_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'held',
            created_at TEXT NOT NULL,
            released_at TEXT
          );
        `)
        .then(() =>
          postgresPool.query(
            "CREATE INDEX IF NOT EXISTS market_escrow_user_status_idx ON market_escrow(user_id, status)",
          ),
        )
        .then(() =>
          postgresPool.query(
            "CREATE INDEX IF NOT EXISTS market_escrow_market_status_idx ON market_escrow(market_id, status)",
          ),
        )
        .then(() => undefined);
    }
    await schemaReady;
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS market_escrow (
      id TEXT PRIMARY KEY,
      trade_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      market_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'held',
      created_at TEXT NOT NULL,
      released_at TEXT
    );
    CREATE INDEX IF NOT EXISTS market_escrow_user_status_idx ON market_escrow(user_id, status);
    CREATE INDEX IF NOT EXISTS market_escrow_market_status_idx ON market_escrow(market_id, status);
  `);
}

export async function getEscrowHeldCents(userId: string): Promise<number> {
  await ensureEscrowSchema();
  if (postgresPool) {
    const result = await postgresPool.query<{ s: string | null }>(
      `SELECT COALESCE(SUM(amount_cents), 0) as s
       FROM market_escrow
       WHERE user_id = $1 AND status = 'held'`,
      [userId],
    );
    return Number(result.rows[0]?.s ?? 0);
  }
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) as s
       FROM market_escrow
       WHERE user_id = ? AND status = 'held'`,
    )
    .get(userId) as { s: number };
  return Number(row?.s ?? 0);
}

/** Lock trade cost in escrow and debit wallet via ledger escrow_hold. */
export async function holdTradeEscrow(input: {
  tradeId: string;
  userId: string;
  marketId: string;
  amountCents: number;
  ledgerNote: string;
  createdAt: string;
  pgClient?: PoolClient;
}): Promise<void> {
  await ensureEscrowSchema();
  const escrowId = randomUUID();
  const ledgerId = randomUUID();
  const amount = Math.floor(input.amountCents);
  if (amount <= 0) return;

  if (postgresPool && input.pgClient) {
    await input.pgClient.query(
      `INSERT INTO market_escrow (id, trade_id, user_id, market_id, amount_cents, status, created_at)
       VALUES ($1,$2,$3,$4,$5,'held',$6)`,
      [escrowId, input.tradeId, input.userId, input.marketId, amount, input.createdAt],
    );
    await input.pgClient.query(
      `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
       VALUES ($1,$2,'escrow_hold',$3,$4,$5)`,
      [ledgerId, input.userId, -amount, input.createdAt, input.ledgerNote],
    );
    return;
  }

  if (postgresPool) {
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO market_escrow (id, trade_id, user_id, market_id, amount_cents, status, created_at)
         VALUES ($1,$2,$3,$4,$5,'held',$6)`,
        [escrowId, input.tradeId, input.userId, input.marketId, amount, input.createdAt],
      );
      await client.query(
        `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
         VALUES ($1,$2,'escrow_hold',$3,$4,$5)`,
        [ledgerId, input.userId, -amount, input.createdAt, input.ledgerNote],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO market_escrow (id, trade_id, user_id, market_id, amount_cents, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'held', ?)`,
    ).run(
      escrowId,
      input.tradeId,
      input.userId,
      input.marketId,
      amount,
      input.createdAt,
    );
    db.prepare(
      `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
       VALUES (?, ?, 'escrow_hold', ?, ?, ?)`,
    ).run(ledgerId, input.userId, -amount, input.createdAt, input.ledgerNote);
  });
  tx();
}

/** Mark escrow released after settlement; losers get an audit ledger row. */
export async function releaseEscrowForSettledTrade(input: {
  tradeId: string;
  userId: string;
  marketId: string;
  won: boolean;
  amountCents: number;
  resolvedAt: string;
  pgClient?: PoolClient;
}): Promise<void> {
  await ensureEscrowSchema();
  const status: EscrowStatus = input.won ? "released_win" : "released_loss";

  if (postgresPool && input.pgClient) {
    await input.pgClient.query(
      `UPDATE market_escrow
       SET status = $2, released_at = $3
       WHERE trade_id = $1 AND status = 'held'`,
      [input.tradeId, status, input.resolvedAt],
    );
    if (!input.won && input.amountCents > 0) {
      await input.pgClient.query(
        `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
         VALUES ($1,$2,'escrow_forfeit',0,$3,$4)`,
        [
          randomUUID(),
          input.userId,
          input.resolvedAt,
          `Escrow forfeited on market ${input.marketId} (losing trade ${input.tradeId})`,
        ],
      );
    }
    return;
  }

  if (postgresPool) {
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE market_escrow
         SET status = $2, released_at = $3
         WHERE trade_id = $1 AND status = 'held'`,
        [input.tradeId, status, input.resolvedAt],
      );
      if (!input.won && input.amountCents > 0) {
        await client.query(
          `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
           VALUES ($1,$2,'escrow_forfeit',0,$3,$4)`,
          [
            randomUUID(),
            input.userId,
            input.resolvedAt,
            `Escrow forfeited on market ${input.marketId} (losing trade ${input.tradeId})`,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE market_escrow
       SET status = ?, released_at = ?
       WHERE trade_id = ? AND status = 'held'`,
    ).run(status, input.resolvedAt, input.tradeId);
    if (!input.won && input.amountCents > 0) {
      db.prepare(
        `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
         VALUES (?, ?, 'escrow_forfeit', 0, ?, ?)`,
      ).run(
        randomUUID(),
        input.userId,
        input.resolvedAt,
        `Escrow forfeited on market ${input.marketId} (losing trade ${input.tradeId})`,
      );
    }
  });
  tx();
}
