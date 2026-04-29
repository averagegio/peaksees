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
    created_at TEXT NOT NULL
  );
`);

export { db };
