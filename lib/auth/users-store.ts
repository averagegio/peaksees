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
  bio: string;
  location: string;
  avatarUrl: string;
  bannerUrl: string;
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
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  banner_url: string | null;
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
          created_at TEXT NOT NULL,
          bio TEXT,
          location TEXT,
          avatar_url TEXT,
          banner_url TEXT
        );
      `)
      .then(() =>
        postgresPool.query(
          "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT",
        ),
      )
      .then(() =>
        postgresPool.query(
          "ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT",
        ),
      )
      .then(() =>
        postgresPool.query(
          "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT",
        ),
      )
      .then(() =>
        postgresPool.query(
          "ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT",
        ),
      )
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
    bio: row.bio ?? "",
    location: row.location ?? "",
    avatarUrl: row.avatar_url ?? "",
    bannerUrl: row.banner_url ?? "",
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
      bio: "",
      location: "",
      avatarUrl: "",
      bannerUrl: "",
    };

    const result = await postgresPool.query<SqliteUserRow>(
      `INSERT INTO users (id, email, display_name, password_hash, created_at, bio, location, avatar_url, banner_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, display_name, password_hash, created_at, bio, location, avatar_url, banner_url`,
      [
        user.id,
        user.email,
        user.displayName,
        user.passwordHash,
        user.createdAt,
        user.bio,
        user.location,
        user.avatarUrl,
        user.bannerUrl,
      ],
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
    bio: "",
    location: "",
    avatarUrl: "",
    bannerUrl: "",
  };

  db.prepare(
    `INSERT INTO users (id, email, display_name, password_hash, created_at, bio, location, avatar_url, banner_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    user.email,
    user.displayName,
    user.passwordHash,
    user.createdAt,
    user.bio,
    user.location,
    user.avatarUrl,
    user.bannerUrl,
  );

  return user;
}

export async function getUserByEmail(
  email: string,
): Promise<StoredUser | null> {
  const e = normalizeEmail(email);
  if (postgresPool) {
    await ensureUsersSchema();
    const result = await postgresPool.query<SqliteUserRow>(
      `SELECT id, email, display_name, password_hash, created_at, bio, location, avatar_url, banner_url
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [e],
    );

    return result.rows[0] ? toStoredUser(result.rows[0]) : null;
  }

  const row = db
    .prepare(
      `SELECT id, email, display_name, password_hash, created_at, bio, location, avatar_url, banner_url
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
      `SELECT id, email, display_name, password_hash, created_at, bio, location, avatar_url, banner_url
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );

    return result.rows[0] ? toStoredUser(result.rows[0]) : null;
  }

  const row = db
    .prepare(
      `SELECT id, email, display_name, password_hash, created_at, bio, location, avatar_url, banner_url
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
    bio: user.bio,
    location: user.location,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
  };
}

export async function updateUserProfile(
  userId: string,
  profile: { displayName: string; bio: string; location?: string; avatarUrl?: string; bannerUrl?: string },
): Promise<StoredUser | null> {
  const displayName = profile.displayName.trim().slice(0, 64);
  const bio = profile.bio.trim().slice(0, 280);
  const location =
    typeof profile.location === "string" ? profile.location.trim().slice(0, 64) : "";
  const avatarUrl =
    typeof profile.avatarUrl === "string" ? profile.avatarUrl.trim() : undefined;
  const bannerUrl =
    typeof profile.bannerUrl === "string" ? profile.bannerUrl.trim() : undefined;
  if (displayName.length < 2) {
    return null;
  }

  if (postgresPool) {
    await ensureUsersSchema();
    const result = await postgresPool.query<SqliteUserRow>(
      `UPDATE users
       SET display_name = $2,
           bio = $3,
           location = $4,
           avatar_url = COALESCE($5, avatar_url),
           banner_url = COALESCE($6, banner_url)
       WHERE id = $1
       RETURNING id, email, display_name, password_hash, created_at, bio, location, avatar_url, banner_url`,
      [userId, displayName, bio, location, avatarUrl ?? null, bannerUrl ?? null],
    );
    return result.rows[0] ? toStoredUser(result.rows[0]) : null;
  }

  if (typeof avatarUrl === "string" && typeof bannerUrl === "string") {
    db.prepare(
      `UPDATE users SET display_name = ?, bio = ?, location = ?, avatar_url = ?, banner_url = ? WHERE id = ?`,
    ).run(displayName, bio, location, avatarUrl, bannerUrl, userId);
  } else if (typeof avatarUrl === "string") {
    db.prepare(
      `UPDATE users SET display_name = ?, bio = ?, location = ?, avatar_url = ? WHERE id = ?`,
    ).run(displayName, bio, location, avatarUrl, userId);
  } else if (typeof bannerUrl === "string") {
    db.prepare(
      `UPDATE users SET display_name = ?, bio = ?, location = ?, banner_url = ? WHERE id = ?`,
    ).run(displayName, bio, location, bannerUrl, userId);
  } else {
    db.prepare(`UPDATE users SET display_name = ?, bio = ?, location = ? WHERE id = ?`).run(
      displayName,
      bio,
      location,
      userId,
    );
  }
  return getUserById(userId);
}

export type PublicUser = ReturnType<typeof toPublicUser>;
