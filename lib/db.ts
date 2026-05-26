import "server-only";

import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

type SqliteDb = import("better-sqlite3").Database;

/** PRAGMA table_info row (avoids `}>;` casts that confuse Turbopack JSX-ish parsing). */
type SqliteColumnInfo = { name: string };

const localDbPath = path.join(process.cwd(), "data", "peaksees.db");
const tmpDbPath = path.join("/tmp", "peaksees.db");

export function isPostgresConfigured(): boolean {
  return Boolean((process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "").trim());
}

function openDbAt(dbPath: string): SqliteDb {
  const requireBetterSqlite3 = createRequire(import.meta.url);
  const Database = requireBetterSqlite3("better-sqlite3") as typeof import("better-sqlite3");
  mkdirSync(path.dirname(dbPath), { recursive: true });
  return new Database(dbPath);
}

function ensureSqliteSchema(conn: SqliteDb) {
  conn.pragma("journal_mode = WAL");

  conn.exec(`
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
  `);

  const userColumns = conn.prepare("PRAGMA table_info(users)").all() as SqliteColumnInfo[];
  if (!userColumns.some((column) => column.name === "bio")) {
    conn.exec("ALTER TABLE users ADD COLUMN bio TEXT");
  }
  if (!userColumns.some((column) => column.name === "avatar_url")) {
    conn.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
  }
  if (!userColumns.some((column) => column.name === "banner_url")) {
    conn.exec("ALTER TABLE users ADD COLUMN banner_url TEXT");
  }
  if (!userColumns.some((column) => column.name === "interactive_feed_tour_v1_at")) {
    conn.exec("ALTER TABLE users ADD COLUMN interactive_feed_tour_v1_at TEXT");
  }
  if (!userColumns.some((column) => column.name === "handle")) {
    conn.exec("ALTER TABLE users ADD COLUMN handle TEXT");
  }
  try {
    conn.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS users_handle_lower_idx ON users (lower(handle)) WHERE handle IS NOT NULL",
    );
  } catch {
    // ignore duplicate index races
  }

  conn.exec(`
    CREATE TABLE IF NOT EXISTS peaks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS peaks_created_at_idx ON peaks(created_at DESC);
    CREATE INDEX IF NOT EXISTS peaks_user_created_at_idx ON peaks(user_id, created_at DESC);
  `);

  const peakColumns = conn.prepare("PRAGMA table_info(peaks)").all() as SqliteColumnInfo[];
  if (!peakColumns.some((column) => column.name === "expires_at")) {
    conn.exec("ALTER TABLE peaks ADD COLUMN expires_at TEXT");
  }

  conn.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_key TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS comments_post_created_at_idx ON comments(post_key, created_at DESC);
    CREATE TABLE IF NOT EXISTS comment_upvotes (
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (comment_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS comment_upvotes_comment_idx ON comment_upvotes(comment_id);

    CREATE TABLE IF NOT EXISTS pinned_posts (
      user_id TEXT NOT NULL,
      post_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, post_key)
    );
    CREATE INDEX IF NOT EXISTS pinned_posts_user_idx ON pinned_posts(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS peakpoints_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS peakpoints_ledger_user_idx ON peakpoints_ledger(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS stripe_wallet_topup_claims (
      stripe_checkout_session_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_follows (
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (follower_id, following_id),
      CHECK (follower_id != following_id)
    );
    CREATE INDEX IF NOT EXISTS user_follows_following_idx ON user_follows(following_id);
    CREATE INDEX IF NOT EXISTS user_follows_follower_idx ON user_follows(follower_id);

    CREATE TABLE IF NOT EXISTS markets (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      hashtags_json TEXT,
      ends_at TEXT NOT NULL,
      resolved_side TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL,
      yes_probability REAL NOT NULL,
      no_probability REAL NOT NULL,
      volume_cents INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS markets_created_at_idx ON markets(created_at DESC);
    CREATE INDEX IF NOT EXISTS markets_category_created_at_idx ON markets(category, created_at DESC);

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
    CREATE INDEX IF NOT EXISTS market_trades_user_created_at_idx ON market_trades(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS market_trades_market_created_at_idx ON market_trades(market_id, created_at DESC);
  `);

  const marketColumns = conn.prepare("PRAGMA table_info(markets)").all() as SqliteColumnInfo[];
  if (!marketColumns.some((column) => column.name === "subcategory")) {
    conn.exec("ALTER TABLE markets ADD COLUMN subcategory TEXT");
  }
  if (!marketColumns.some((column) => column.name === "hashtags_json")) {
    conn.exec("ALTER TABLE markets ADD COLUMN hashtags_json TEXT");
  }
  if (!marketColumns.some((column) => column.name === "resolved_side")) {
    conn.exec("ALTER TABLE markets ADD COLUMN resolved_side TEXT");
  }
  if (!marketColumns.some((column) => column.name === "resolved_at")) {
    conn.exec("ALTER TABLE markets ADD COLUMN resolved_at TEXT");
  }
  try {
    conn.exec(
      "CREATE INDEX IF NOT EXISTS markets_category_subcategory_created_at_idx ON markets(category, subcategory, created_at DESC)",
    );
  } catch {
    // ignore
  }

  const tradeColumns = conn
    .prepare("PRAGMA table_info(market_trades)")
    .all() as SqliteColumnInfo[];
  if (!tradeColumns.some((column) => column.name === "settled_at")) {
    conn.exec("ALTER TABLE market_trades ADD COLUMN settled_at TEXT");
  }
  if (!tradeColumns.some((column) => column.name === "payout_cents")) {
    conn.exec("ALTER TABLE market_trades ADD COLUMN payout_cents INTEGER NOT NULL DEFAULT 0");
  }
  try {
    conn.exec(
      "CREATE INDEX IF NOT EXISTS market_trades_market_settled_idx ON market_trades(market_id, settled_at)",
    );
  } catch {
    // ignore
  }

  conn.exec(`
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

  try {
    conn.exec(
      "CREATE INDEX IF NOT EXISTS markets_unresolved_ends_at_idx ON markets(ends_at) WHERE resolved_side IS NULL",
    );
  } catch {
    // ignore
  }
}

let sqliteDb: SqliteDb | null = null;

/** Local dev fallback only — never opened on Vercel when Postgres is configured. */
function getSqliteDb(): SqliteDb {
  if (isPostgresConfigured()) {
    throw new Error(
      "SQLite was requested but POSTGRES_URL/DATABASE_URL is set. Route this call through Postgres.",
    );
  }
  if (process.env.VERCEL) {
    throw new Error(
      "POSTGRES_URL or DATABASE_URL is required on Vercel. Link Neon under Project → Storage and redeploy.",
    );
  }
  if (!sqliteDb) {
    try {
      sqliteDb = openDbAt(localDbPath);
    } catch {
      sqliteDb = openDbAt(tmpDbPath);
    }
    ensureSqliteSchema(sqliteDb);
  }
  return sqliteDb;
}

/** Lazy SQLite handle for local dev; unused when Neon/Postgres env is set. */
export const db: SqliteDb = new Proxy({} as SqliteDb, {
  get(_target, prop, receiver) {
    const conn = getSqliteDb();
    const value = Reflect.get(conn, prop, receiver);
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(conn);
    }
    return value;
  },
});
