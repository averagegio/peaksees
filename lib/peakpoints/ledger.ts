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

