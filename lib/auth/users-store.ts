import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  defaultHandleFromEmail,
  formatAtHandle,
  normalizeHandleInput,
  RESERVED_HANDLES,
  validateHandle,
} from "@/lib/auth/handle";
import { isPeakAiHandle } from "@/lib/peak-ai/profile";
import { Pool } from "pg";

export type StoredUser = {
  id: string;
  email: string;
  /** Lowercase slug without @ */
  handle: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  interactiveFeedTourV1At: string | null;
};

export type ProfileUpdateResult =
  | StoredUser
  | { error: "handle_taken" }
  | { error: "handle_invalid"; message: string }
  | null;

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
  avatar_url: string | null;
  banner_url: string | null;
  interactive_feed_tour_v1_at: string | null;
  handle: string | null;
};

const USER_SELECT = `id, email, display_name, password_hash, created_at, bio, avatar_url, banner_url, interactive_feed_tour_v1_at, handle`;

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
let handlesBackfillPromise: Promise<void> | null = null;

function resolveRowHandle(row: SqliteUserRow): string {
  const stored = typeof row.handle === "string" ? row.handle.trim().toLowerCase() : "";
  if (stored.length >= 3 && !RESERVED_HANDLES.has(stored)) return stored;
  return defaultHandleFromEmail(row.email);
}

function toStoredUser(row: SqliteUserRow): StoredUser {
  return {
    id: row.id,
    email: row.email,
    handle: resolveRowHandle(row),
    displayName: row.display_name,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    bio: row.bio ?? "",
    avatarUrl: row.avatar_url ?? "",
    bannerUrl: row.banner_url ?? "",
    interactiveFeedTourV1At:
      typeof row.interactive_feed_tour_v1_at === "string" &&
      row.interactive_feed_tour_v1_at.trim()
        ? row.interactive_feed_tour_v1_at.trim()
        : null,
  };
}

async function backfillUserHandles(): Promise<void> {
  const taken = new Set<string>([...RESERVED_HANDLES]);

  if (postgresPool) {
    const result = await postgresPool.query<SqliteUserRow>(
      `SELECT ${USER_SELECT} FROM users ORDER BY created_at ASC`,
    );
    for (const row of result.rows) {
      const user = toStoredUser(row);
      let candidate = user.handle;
      if (taken.has(candidate)) {
        candidate = `${candidate.slice(0, 24)}_${user.id.slice(0, 6)}`;
      }
      taken.add(candidate);
      if (row.handle?.trim().toLowerCase() !== candidate) {
        await postgresPool.query(`UPDATE users SET handle = $2 WHERE id = $1`, [
          user.id,
          candidate,
        ]);
      }
    }
    return;
  }

  const rows = db
    .prepare(`SELECT ${USER_SELECT} FROM users ORDER BY created_at ASC`)
    .all() as SqliteUserRow[];

  const update = db.prepare(`UPDATE users SET handle = ? WHERE id = ?`);
  for (const row of rows) {
    const user = toStoredUser(row);
    let candidate = user.handle;
    if (taken.has(candidate)) {
      candidate = `${candidate.slice(0, 24)}_${user.id.slice(0, 6)}`;
    }
    taken.add(candidate);
    if (row.handle?.trim().toLowerCase() !== candidate) {
      update.run(candidate, user.id);
    }
  }
}

async function ensureUserHandlesBackfill() {
  if (!handlesBackfillPromise) {
    handlesBackfillPromise = backfillUserHandles().catch((err) => {
      handlesBackfillPromise = null;
      throw err;
    });
  }
  await handlesBackfillPromise;
}

async function pickAvailableHandle(
  preferred: string,
  excludeUserId?: string,
): Promise<string> {
  await ensureUserHandlesBackfill();
  let candidate = preferred;
  let n = 0;
  while (n < 50) {
    const existing = await getUserByHandleSlug(candidate);
    if (!existing || existing.id === excludeUserId) return candidate;
    n += 1;
    candidate = `${preferred.slice(0, 24)}_${n}`.slice(0, 32);
  }
  return `${preferred.slice(0, 20)}_${randomUUID().slice(0, 6)}`.slice(0, 32);
}

async function ensureUsersSchema() {
  if (postgresPool) {
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
          avatar_url TEXT,
          banner_url TEXT
        );
      `)
        .then(() =>
          postgresPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT"),
        )
        .then(() =>
          postgresPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT"),
        )
        .then(() =>
          postgresPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT"),
        )
        .then(() =>
          postgresPool.query(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS interactive_feed_tour_v1_at TEXT",
          ),
        )
        .then(() =>
          postgresPool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS handle TEXT"),
        )
        .then(() =>
          postgresPool.query(
            "CREATE UNIQUE INDEX IF NOT EXISTS users_handle_lower_idx ON users (lower(handle))",
          ),
        )
        .then(() => undefined);
    }
    await schemaReadyPromise;
  }
  await ensureUserHandlesBackfill();
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<StoredUser | { error: "email_taken" }> {
  const email = normalizeEmail(input.email);
  await ensureUsersSchema();
  const handle = await pickAvailableHandle(defaultHandleFromEmail(email));

  if (postgresPool) {
    const user: StoredUser = {
      id: randomUUID(),
      email,
      handle,
      displayName: input.displayName.trim(),
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString(),
      bio: "",
      avatarUrl: "",
      bannerUrl: "",
      interactiveFeedTourV1At: null,
    };

    const result = await postgresPool.query<SqliteUserRow>(
      `INSERT INTO users (id, email, display_name, password_hash, created_at, bio, avatar_url, banner_url, interactive_feed_tour_v1_at, handle)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9)
       ON CONFLICT (email) DO NOTHING
       RETURNING ${USER_SELECT}`,
      [
        user.id,
        user.email,
        user.displayName,
        user.passwordHash,
        user.createdAt,
        user.bio,
        user.avatarUrl,
        user.bannerUrl,
        user.handle,
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
    handle,
    displayName: input.displayName.trim(),
    passwordHash: input.passwordHash,
    createdAt: new Date().toISOString(),
    bio: "",
    avatarUrl: "",
    bannerUrl: "",
    interactiveFeedTourV1At: null,
  };

  db.prepare(
    `INSERT INTO users (id, email, display_name, password_hash, created_at, bio, avatar_url, banner_url, handle)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    user.id,
    user.email,
    user.displayName,
    user.passwordHash,
    user.createdAt,
    user.bio,
    user.avatarUrl,
    user.bannerUrl,
    user.handle,
  );

  return user;
}

export async function getUserByEmail(email: string): Promise<StoredUser | null> {
  const e = normalizeEmail(email);
  await ensureUsersSchema();
  if (postgresPool) {
    const result = await postgresPool.query<SqliteUserRow>(
      `SELECT ${USER_SELECT} FROM users WHERE email = $1 LIMIT 1`,
      [e],
    );
    return result.rows[0] ? toStoredUser(result.rows[0]) : null;
  }

  const row = db
    .prepare(`SELECT ${USER_SELECT} FROM users WHERE email = ? LIMIT 1`)
    .get(e) as SqliteUserRow | undefined;

  return row ? toStoredUser(row) : null;
}

export async function getUserByHandleSlug(slug: string): Promise<StoredUser | null> {
  const s = normalizeHandleInput(slug);
  if (!s || isPeakAiHandle(s)) return null;

  await ensureUsersSchema();

  if (postgresPool) {
    const result = await postgresPool.query<SqliteUserRow>(
      `SELECT ${USER_SELECT} FROM users WHERE lower(handle) = $1 LIMIT 1`,
      [s],
    );
    if (result.rows[0]) return toStoredUser(result.rows[0]);

    const legacy = await postgresPool.query<SqliteUserRow>(
      `SELECT ${USER_SELECT} FROM users
       WHERE handle IS NULL AND lower(split_part(email, '@', 1)) = $1
       LIMIT 1`,
      [s],
    );
    return legacy.rows[0] ? toStoredUser(legacy.rows[0]) : null;
  }

  const row = db
    .prepare(`SELECT ${USER_SELECT} FROM users WHERE lower(handle) = ? LIMIT 1`)
    .get(s) as SqliteUserRow | undefined;
  if (row) return toStoredUser(row);

  const legacy = db
    .prepare(
      `SELECT ${USER_SELECT} FROM users
       WHERE (handle IS NULL OR trim(handle) = '')
       AND lower(substr(email, 1, instr(email, '@') - 1)) = ?
       LIMIT 1`,
    )
    .get(s) as SqliteUserRow | undefined;

  return legacy ? toStoredUser(legacy) : null;
}

export async function getUserById(id: string): Promise<StoredUser | null> {
  await ensureUsersSchema();
  if (postgresPool) {
    const result = await postgresPool.query<SqliteUserRow>(
      `SELECT ${USER_SELECT} FROM users WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] ? toStoredUser(result.rows[0]) : null;
  }

  const row = db
    .prepare(`SELECT ${USER_SELECT} FROM users WHERE id = ? LIMIT 1`)
    .get(id) as SqliteUserRow | undefined;

  return row ? toStoredUser(row) : null;
}

export function toPublicUser(user: StoredUser) {
  return {
    id: user.id,
    email: user.email,
    handle: user.handle,
    atHandle: formatAtHandle(user.handle),
    displayName: user.displayName,
    createdAt: user.createdAt,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    interactiveFeedTourV1Completed: Boolean(user.interactiveFeedTourV1At?.trim()),
  };
}

export async function updateUserProfile(
  userId: string,
  profile: {
    displayName: string;
    bio: string;
    handle?: string;
    avatarUrl?: string;
    bannerUrl?: string;
  },
): Promise<ProfileUpdateResult> {
  const displayName = profile.displayName.trim().slice(0, 64);
  const bio = profile.bio.trim().slice(0, 280);
  const avatarUrl =
    typeof profile.avatarUrl === "string" ? profile.avatarUrl.trim() : undefined;
  const bannerUrl =
    typeof profile.bannerUrl === "string" ? profile.bannerUrl.trim() : undefined;

  if (displayName.length < 2) return null;

  let nextHandle: string | undefined;
  if (typeof profile.handle === "string" && profile.handle.trim()) {
    const parsed = validateHandle(profile.handle);
    if (!parsed.ok) return { error: "handle_invalid", message: parsed.message };
    const existing = await getUserByHandleSlug(parsed.handle);
    if (existing && existing.id !== userId) {
      return { error: "handle_taken" };
    }
    nextHandle = parsed.handle;
  }

  await ensureUsersSchema();

  if (postgresPool) {
    const result = await postgresPool.query<SqliteUserRow>(
      `UPDATE users
       SET display_name = $2,
           bio = $3,
           avatar_url = COALESCE($4, avatar_url),
           banner_url = COALESCE($5, banner_url),
           handle = COALESCE($6, handle)
       WHERE id = $1
       RETURNING ${USER_SELECT}`,
      [userId, displayName, bio, avatarUrl ?? null, bannerUrl ?? null, nextHandle ?? null],
    );
    return result.rows[0] ? toStoredUser(result.rows[0]) : null;
  }

  const current = await getUserById(userId);
  if (!current) return null;

  const handleValue = nextHandle ?? current.handle;

  if (typeof avatarUrl === "string" && typeof bannerUrl === "string") {
    db.prepare(
      `UPDATE users SET display_name = ?, bio = ?, avatar_url = ?, banner_url = ?, handle = ? WHERE id = ?`,
    ).run(displayName, bio, avatarUrl, bannerUrl, handleValue, userId);
  } else if (typeof avatarUrl === "string") {
    db.prepare(
      `UPDATE users SET display_name = ?, bio = ?, avatar_url = ?, handle = ? WHERE id = ?`,
    ).run(displayName, bio, avatarUrl, handleValue, userId);
  } else if (typeof bannerUrl === "string") {
    db.prepare(
      `UPDATE users SET display_name = ?, bio = ?, banner_url = ?, handle = ? WHERE id = ?`,
    ).run(displayName, bio, bannerUrl, handleValue, userId);
  } else {
    db.prepare(`UPDATE users SET display_name = ?, bio = ?, handle = ? WHERE id = ?`).run(
      displayName,
      bio,
      handleValue,
      userId,
    );
  }
  return getUserById(userId);
}

export async function markInteractiveFeedTourV1Completed(userId: string): Promise<boolean> {
  const at = new Date().toISOString();
  await ensureUsersSchema();
  if (postgresPool) {
    const result = await postgresPool.query(
      `UPDATE users
       SET interactive_feed_tour_v1_at = COALESCE(interactive_feed_tour_v1_at, $2)
       WHERE id = $1`,
      [userId, at],
    );
    return typeof result.rowCount === "number" ? result.rowCount > 0 : true;
  }
  const row = db
    .prepare("SELECT id FROM users WHERE id = ? LIMIT 1")
    .get(userId) as { id: string } | undefined;
  if (!row) return false;
  db.prepare(
    `UPDATE users
     SET interactive_feed_tour_v1_at = COALESCE(interactive_feed_tour_v1_at, ?)
     WHERE id = ?`,
  ).run(at, userId);
  return true;
}

export type PublicUser = ReturnType<typeof toPublicUser>;
