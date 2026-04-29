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
    avatar_url TEXT
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

db.exec(`
  CREATE TABLE IF NOT EXISTS peaks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS peaks_created_at_idx ON peaks(created_at DESC);
  CREATE INDEX IF NOT EXISTS peaks_user_created_at_idx ON peaks(user_id, created_at DESC);
`);

export { db };
