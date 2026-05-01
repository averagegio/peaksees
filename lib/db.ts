import "server-only";

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

function openDbAt(dbPath: string) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  return new Database(dbPath);
}

const localDbPath = path.join(process.cwd(), "data", "peaksees.db");
const tmpDbPath = path.join("/tmp", "peaksees.db");

let db: Database.Database;
try {
  db = openDbAt(localDbPath);
} catch {
  // Serverless hosts often expose writable /tmp only.
  db = openDbAt(tmpDbPath);
}

db.pragma("journal_mode = WAL");

db.exec(`
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

const userColumns = db
  .prepare("PRAGMA table_info(users)")
  .all() as Array<{ name: string }>;
if (!userColumns.some((column) => column.name === "bio")) {
  db.exec("ALTER TABLE users ADD COLUMN bio TEXT");
}
if (!userColumns.some((column) => column.name === "avatar_url")) {
  db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
}
if (!userColumns.some((column) => column.name === "banner_url")) {
  db.exec("ALTER TABLE users ADD COLUMN banner_url TEXT");
}

db.exec(`
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

const peakColumns = db
  .prepare("PRAGMA table_info(peaks)")
  .all() as Array<{ name: string }>;
if (!peakColumns.some((column) => column.name === "expires_at")) {
  db.exec("ALTER TABLE peaks ADD COLUMN expires_at TEXT");
}

db.exec(`
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
    side TEXT NOT NULL, -- yes | no
    price_cents INTEGER NOT NULL, -- 1..99, price per $1 share
    shares_x1000 INTEGER NOT NULL, -- shares * 1000 for precision
    cost_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    settled_at TEXT,
    payout_cents INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS market_trades_user_created_at_idx ON market_trades(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS market_trades_market_created_at_idx ON market_trades(market_id, created_at DESC);
`);

const marketColumns = db
  .prepare("PRAGMA table_info(markets)")
  .all() as Array<{ name: string }>;
if (!marketColumns.some((column) => column.name === "subcategory")) {
  db.exec("ALTER TABLE markets ADD COLUMN subcategory TEXT");
}
if (!marketColumns.some((column) => column.name === "hashtags_json")) {
  db.exec("ALTER TABLE markets ADD COLUMN hashtags_json TEXT");
}
if (!marketColumns.some((column) => column.name === "resolved_side")) {
  db.exec("ALTER TABLE markets ADD COLUMN resolved_side TEXT");
}
if (!marketColumns.some((column) => column.name === "resolved_at")) {
  db.exec("ALTER TABLE markets ADD COLUMN resolved_at TEXT");
}
try {
  db.exec(
    "CREATE INDEX IF NOT EXISTS markets_category_subcategory_created_at_idx ON markets(category, subcategory, created_at DESC)",
  );
} catch {
  // ignore
}

const tradeColumns = db
  .prepare("PRAGMA table_info(market_trades)")
  .all() as Array<{ name: string }>;
if (!tradeColumns.some((column) => column.name === "settled_at")) {
  db.exec("ALTER TABLE market_trades ADD COLUMN settled_at TEXT");
}
if (!tradeColumns.some((column) => column.name === "payout_cents")) {
  db.exec("ALTER TABLE market_trades ADD COLUMN payout_cents INTEGER NOT NULL DEFAULT 0");
}
try {
  db.exec(
    "CREATE INDEX IF NOT EXISTS market_trades_market_settled_idx ON market_trades(market_id, settled_at)",
  );
} catch {
  // ignore
}

export { db };
