import "server-only";

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { db } from "@/lib/db";
import { payoutCentsAfterWithdrawFee } from "@/lib/peakpoints/fees";

export type WithdrawalStatus = "pending" | "processing" | "paid" | "failed";

export type Withdrawal = {
  id: string;
  userId: string;
  amountCents: number;
  payoutCents: number;
  status: WithdrawalStatus;
  provider: string;
  providerPayoutId: string | null;
  createdAt: string;
  processedAt: string | null;
  note: string | null;
};

type WithdrawalRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  payout_cents: number;
  status: string;
  provider: string;
  provider_payout_id: string | null;
  created_at: string;
  processed_at: string | null;
  note: string | null;
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

export async function ensureWithdrawalsSchema(): Promise<void> {
  if (postgresPool) {
    if (!schemaReady) {
      schemaReady = postgresPool
        .query(`
          CREATE TABLE IF NOT EXISTS withdrawals (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            payout_cents INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            provider TEXT NOT NULL DEFAULT 'stub',
            provider_payout_id TEXT,
            created_at TEXT NOT NULL,
            processed_at TEXT,
            note TEXT
          );
        `)
        .then(() =>
          postgresPool.query(
            "CREATE INDEX IF NOT EXISTS withdrawals_user_created_at_idx ON withdrawals(user_id, created_at DESC)",
          ),
        )
        .then(() =>
          postgresPool.query(
            "CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_provider_payout_id_uq ON withdrawals(provider_payout_id) WHERE provider_payout_id IS NOT NULL",
          ),
        )
        .then(() => undefined);
    }
    await schemaReady;
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS withdrawals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      payout_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      provider TEXT NOT NULL DEFAULT 'stub',
      provider_payout_id TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS withdrawals_user_created_at_idx ON withdrawals(user_id, created_at DESC);
  `);
}

function rowToWithdrawal(row: WithdrawalRow): Withdrawal {
  return {
    id: row.id,
    userId: row.user_id,
    amountCents: row.amount_cents,
    payoutCents: row.payout_cents,
    status: row.status as WithdrawalStatus,
    provider: row.provider,
    providerPayoutId: row.provider_payout_id,
    createdAt: row.created_at,
    processedAt: row.processed_at,
    note: row.note,
  };
}

export async function listWithdrawals(userId: string, limit = 20): Promise<Withdrawal[]> {
  await ensureWithdrawalsSchema();
  const capped = Math.max(1, Math.min(50, Math.floor(limit)));

  if (postgresPool) {
    const result = await postgresPool.query<WithdrawalRow>(
      `SELECT id, user_id, amount_cents, payout_cents, status, provider, provider_payout_id, created_at, processed_at, note
       FROM withdrawals
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, capped],
    );
    return result.rows.map(rowToWithdrawal);
  }

  const rows = db
    .prepare(
      `SELECT id, user_id, amount_cents, payout_cents, status, provider, provider_payout_id, created_at, processed_at, note
       FROM withdrawals
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(userId, capped) as WithdrawalRow[];
  return rows.map(rowToWithdrawal);
}

/** Atomically create a pending withdrawal and debit the wallet. */
export async function createWithdrawal(input: {
  userId: string;
  amountCents: number;
  note?: string;
}): Promise<Withdrawal> {
  await ensureWithdrawalsSchema();
  const amountCents = Math.floor(input.amountCents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    throw new Error("amountCents must be > 0");
  }

  const payoutCents = payoutCentsAfterWithdrawFee(amountCents);
  const id = randomUUID();
  const ledgerId = randomUUID();
  const createdAt = new Date().toISOString();
  const note =
    input.note ??
    `Withdrawal request (${payoutCents}c estimated payout after platform fee)`;

  if (postgresPool) {
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");
      const balRes = await client.query<{ s: string | null }>(
        `SELECT COALESCE(SUM(amount_cents), 0) as s FROM peakpoints_ledger WHERE user_id = $1`,
        [input.userId],
      );
      const bal = Number(balRes.rows[0]?.s ?? 0);
      if (bal < amountCents) throw new Error("Insufficient balance");

      await client.query(
        `INSERT INTO withdrawals (id, user_id, amount_cents, payout_cents, status, provider, created_at, note)
         VALUES ($1,$2,$3,$4,'pending','stub',$5,$6)`,
        [id, input.userId, amountCents, payoutCents, createdAt, note],
      );
      await client.query(
        `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
         VALUES ($1,$2,'withdraw',$3,$4,$5)`,
        [ledgerId, input.userId, -amountCents, createdAt, note],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  } else {
    const tx = db.transaction(() => {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) as s FROM peakpoints_ledger WHERE user_id = ?`,
        )
        .get(input.userId) as { s: number };
      if (Number(row?.s ?? 0) < amountCents) throw new Error("Insufficient balance");

      db.prepare(
        `INSERT INTO withdrawals (id, user_id, amount_cents, payout_cents, status, provider, created_at, note)
         VALUES (?, ?, ?, ?, 'pending', 'stub', ?, ?)`,
      ).run(id, input.userId, amountCents, payoutCents, createdAt, note);
      db.prepare(
        `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
         VALUES (?, ?, 'withdraw', ?, ?, ?)`,
      ).run(ledgerId, input.userId, -amountCents, createdAt, note);
    });
    tx();
  }

  return {
    id,
    userId: input.userId,
    amountCents,
    payoutCents,
    status: "pending",
    provider: "stub",
    providerPayoutId: null,
    createdAt,
    processedAt: null,
    note,
  };
}
