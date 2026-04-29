import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { Pool } from "pg";

export type StoredUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type SqliteUserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
};

const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
const usePostgres = postgresUrl.length > 0;

const postgresPool = usePostgres
  ? new Pool({
      connectionString: postgresUrl,
      ssl: postgresUrl.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    })
  : null;

let schemaReadyPromise: Promise<void> | null = null;

async function ensureUsersSchema() {
  if (!postgresPool) return;
  if (!schemaReadyPromise) {
    schemaReadyPromise = postgresPool
      .query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `)
      .then(() => undefined);
  }
  await schemaReadyPromise;
}

function toStoredUser(row: SqliteUserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<StoredUser | { error: "email_taken" }> {
  const email = normalizeEmail(input.email);
  if (postgresPool) {
    await ensureUsersSchema();

    const user: StoredUser = {
      id: randomUUID(),
      email,
      displayName: input.displayName.trim(),
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString(),
    };

    const result = await postgresPool.query<SqliteUserRow>(
      `INSERT INTO users (id, email, display_name, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, display_name, password_hash, created_at`,
      [user.id, user.email, user.displayName, user.passwordHash, user.createdAt],
    );

    if (!result.rows[0]) {
      return { error: "email_taken" };
    }

    return toStoredUser(result.rows[0]);
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
    .get(email) as { id: string } | undefined;

  if (existing) return { error: "email_taken" };

  const user: StoredUser = {
    id: randomUUID(),
    email,
    displayName: input.displayName.trim(),
    passwordHash: input.passwordHash,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    `INSERT INTO users (id, email, display_name, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(user.id, user.email, user.displayName, user.passwordHash, user.createdAt);

  return user;
}

export async function getUserByEmail(
  email: string,
): Promise<StoredUser | null> {
  const e = normalizeEmail(email);
  if (postgresPool) {
    await ensureUsersSchema();
    const result = await postgresPool.query<SqliteUserRow>(
      `SELECT id, email, display_name, password_hash, created_at
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [e],
    );

    return result.rows[0] ? toStoredUser(result.rows[0]) : null;
  }

  const row = db
    .prepare(
      `SELECT id, email, display_name, password_hash, created_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
    )
    .get(e) as SqliteUserRow | undefined;

  return row ? toStoredUser(row) : null;
}

export async function getUserById(id: string): Promise<StoredUser | null> {
  if (postgresPool) {
    await ensureUsersSchema();
    const result = await postgresPool.query<SqliteUserRow>(
      `SELECT id, email, display_name, password_hash, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return result.rows[0] ? toStoredUser(result.rows[0]) : null;
  }

  const row = db
    .prepare(
      `SELECT id, email, display_name, password_hash, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
    )
    .get(id) as SqliteUserRow | undefined;

  return row ? toStoredUser(row) : null;
}

export function toPublicUser(user: StoredUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
