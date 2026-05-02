import "server-only";

import { randomUUID } from "node:crypto";
import { Pool } from "pg";

import { db } from "@/lib/db";

export type LedgerEntry = {
  id: string;
  kind: "deposit" | "withdraw" | "reward" | "spend";
  amountCents: number;
  createdAt: string;
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
async function ensureSchema() {
  if (!postgresPool) return;
  if (!schemaReady) {
    schemaReady = postgresPool
      .query(`
        CREATE TABLE IF NOT EXISTS peakpoints_ledger (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          amount_cents INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          note TEXT
        );
      `)
      .then(() =>
        postgresPool.query(
          "CREATE INDEX IF NOT EXISTS peakpoints_ledger_user_idx ON peakpoints_ledger(user_id, created_at DESC)",
        ),
      )
      .then(() =>
        postgresPool.query(`
          CREATE TABLE IF NOT EXISTS stripe_wallet_topup_claims (
            stripe_checkout_session_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL
          );
        `),
      )
      .then(() => undefined);
  }
  await schemaReady;
}

export async function getBalanceCents(userId: string): Promise<number> {
  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<{ s: string | null }>(
      `SELECT COALESCE(SUM(amount_cents), 0) as s FROM peakpoints_ledger WHERE user_id = $1`,
      [userId],
    );
    return Number(result.rows[0]?.s ?? 0);
  }
  const row = db
    .prepare(`SELECT COALESCE(SUM(amount_cents), 0) as s FROM peakpoints_ledger WHERE user_id = ?`)
    .get(userId) as { s: number };
  return Number(row?.s ?? 0);
}

export async function listLedger(userId: string): Promise<LedgerEntry[]> {
  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<{
      id: string;
      kind: string;
      amount_cents: number;
      created_at: string;
      note: string | null;
    }>(
      `SELECT id, kind, amount_cents, created_at, note
       FROM peakpoints_ledger
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    );
    return result.rows.map((r) => ({
      id: r.id,
      kind: r.kind as LedgerEntry["kind"],
      amountCents: r.amount_cents,
      createdAt: r.created_at,
      note: r.note,
    }));
  }

  const rows = db
    .prepare(
      `SELECT id, kind, amount_cents, created_at, note
       FROM peakpoints_ledger
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    .all(userId) as Array<{
    id: string;
    kind: string;
    amount_cents: number;
    created_at: string;
    note: string | null;
  }>;

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as LedgerEntry["kind"],
    amountCents: r.amount_cents,
    createdAt: r.created_at,
    note: r.note,
  }));
}

/**
 * Atomically claims this Checkout Session ID and inserts a deposit row, once.
 * Duplicate Stripe webhook deliveries return false without duplicating ledger rows.
 */
export async function tryCreditWalletTopupOnce(input: {
  checkoutSessionId: string;
  userId: string;
  creditedCents: number;
  note: string;
}): Promise<boolean> {
  const sessionId = input.checkoutSessionId.trim();
  if (!sessionId || input.creditedCents <= 0) return false;
  const ledgerId = randomUUID();
  const createdAt = new Date().toISOString();

  if (postgresPool) {
    await ensureSchema();
    const client = await postgresPool.connect();
    try {
      await client.query("BEGIN");
      const ins = await client.query<{ stripe_checkout_session_id: string }>(
        `INSERT INTO stripe_wallet_topup_claims (stripe_checkout_session_id, created_at)
         VALUES ($1, $2)
         ON CONFLICT (stripe_checkout_session_id) DO NOTHING
         RETURNING stripe_checkout_session_id`,
        [sessionId, createdAt],
      );
      if (ins.rows.length === 0) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query(
        `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ledgerId, input.userId, "deposit", input.creditedCents, createdAt, input.note],
      );
      await client.query("COMMIT");
      return true;
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore
      }
      throw e;
    } finally {
      client.release();
    }
  }

  const claimRun = db.transaction(() => {
    const claim = db
      .prepare(
        `INSERT OR IGNORE INTO stripe_wallet_topup_claims (stripe_checkout_session_id, created_at)
         VALUES (?, ?)`,
      )
      .run(sessionId, createdAt);
    if (claim.changes === 0) return false;
    db.prepare(
      `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(ledgerId, input.userId, "deposit", input.creditedCents, createdAt, input.note);
    return true;
  });
  return claimRun();
}

export async function addLedgerEntry(input: {
  userId: string;
  kind: LedgerEntry["kind"];
  amountCents: number;
  note?: string;
}): Promise<void> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const note = input.note ?? null;

  if (postgresPool) {
    await ensureSchema();
    await postgresPool.query(
      `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, input.userId, input.kind, input.amountCents, createdAt, note],
    );
    return;
  }

  db.prepare(
    `INSERT INTO peakpoints_ledger (id, user_id, kind, amount_cents, created_at, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, input.userId, input.kind, input.amountCents, createdAt, note);
}

