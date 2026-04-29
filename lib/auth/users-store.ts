import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type StoredUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

type StoreFile = { users: StoredUser[] };

const DATA_PATH = path.join(process.cwd(), "data", "users.json");

async function readStore(): Promise<StoreFile> {
  try {
    const raw = await readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!Array.isArray(parsed.users)) return { users: [] };
    return parsed;
  } catch {
    return { users: [] };
  }
}

async function writeStore(data: StoreFile): Promise<void> {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<StoredUser | { error: "email_taken" }> {
  const store = await readStore();
  const email = normalizeEmail(input.email);
  if (store.users.some((u) => normalizeEmail(u.email) === email)) {
    return { error: "email_taken" };
  }
  const user: StoredUser = {
    id: randomUUID(),
    email,
    displayName: input.displayName.trim(),
    passwordHash: input.passwordHash,
    createdAt: new Date().toISOString(),
  };
  store.users.push(user);
  await writeStore(store);
  return user;
}

export async function getUserByEmail(
  email: string,
): Promise<StoredUser | null> {
  const e = normalizeEmail(email);
  const store = await readStore();
  return store.users.find((u) => normalizeEmail(u.email) === e) ?? null;
}

export async function getUserById(id: string): Promise<StoredUser | null> {
  const store = await readStore();
  return store.users.find((u) => u.id === id) ?? null;
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
