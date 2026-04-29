import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

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

export async function createUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<StoredUser | { error: "email_taken" }> {
  const email = normalizeEmail(input.email);
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ? LIMIT 1")
    .get(email) as { id: string } | undefined;

  if (existing) {
    return { error: "email_taken" };
  }

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
  const row = db
    .prepare(
      `SELECT id, email, display_name, password_hash, created_at
       FROM users
       WHERE email = ?
       LIMIT 1`,
    )
    .get(e) as
    | {
        id: string;
        email: string;
        display_name: string;
        password_hash: string;
        created_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

export async function getUserById(id: string): Promise<StoredUser | null> {
  const row = db
    .prepare(
      `SELECT id, email, display_name, password_hash, created_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
    )
    .get(id) as
    | {
        id: string;
        email: string;
        display_name: string;
        password_hash: string;
        created_at: string;
      }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
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
