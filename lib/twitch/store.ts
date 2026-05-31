import "server-only";

import { Pool } from "pg";

import { db } from "@/lib/db";

export type TwitchChannelPin = {
  channelLogin: string;
  marketId: string;
  updatedByUserId: string;
  updatedAt: string;
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

export async function ensureTwitchSchema(): Promise<void> {
  if (postgresPool) {
    if (!schemaReady) {
      schemaReady = postgresPool
        .query(`
          CREATE TABLE IF NOT EXISTS twitch_channel_pins (
            channel_login TEXT PRIMARY KEY,
            market_id TEXT NOT NULL,
            updated_by_user_id TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `)
        .then(() =>
          postgresPool.query(
            "CREATE INDEX IF NOT EXISTS twitch_channel_pins_market_idx ON twitch_channel_pins(market_id)",
          ),
        )
        .then(() => undefined);
    }
    await schemaReady;
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS twitch_channel_pins (
      channel_login TEXT PRIMARY KEY,
      market_id TEXT NOT NULL,
      updated_by_user_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS twitch_channel_pins_market_idx ON twitch_channel_pins(market_id);
  `);
}

export function normalizeTwitchChannelLogin(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, "").slice(0, 32);
}

export async function pinMarketToTwitchChannel(input: {
  channelLogin: string;
  marketId: string;
  userId: string;
}): Promise<TwitchChannelPin> {
  await ensureTwitchSchema();
  const channelLogin = normalizeTwitchChannelLogin(input.channelLogin);
  const marketId = input.marketId.trim();
  if (!channelLogin || !/^[a-z0-9_]{3,32}$/.test(channelLogin)) {
    throw new Error("Invalid Twitch channel login");
  }
  if (!marketId) throw new Error("marketId required");

  const updatedAt = new Date().toISOString();

  if (postgresPool) {
    await postgresPool.query(
      `INSERT INTO twitch_channel_pins (channel_login, market_id, updated_by_user_id, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (channel_login) DO UPDATE SET
         market_id = EXCLUDED.market_id,
         updated_by_user_id = EXCLUDED.updated_by_user_id,
         updated_at = EXCLUDED.updated_at`,
      [channelLogin, marketId, input.userId, updatedAt],
    );
  } else {
    db.prepare(
      `INSERT INTO twitch_channel_pins (channel_login, market_id, updated_by_user_id, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(channel_login) DO UPDATE SET
         market_id = excluded.market_id,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = excluded.updated_at`,
    ).run(channelLogin, marketId, input.userId, updatedAt);
  }

  return { channelLogin, marketId, updatedByUserId: input.userId, updatedAt };
}

export async function getPinnedMarketForChannel(
  channelLogin: string,
): Promise<TwitchChannelPin | null> {
  await ensureTwitchSchema();
  const login = normalizeTwitchChannelLogin(channelLogin);
  if (!login) return null;

  if (postgresPool) {
    const result = await postgresPool.query<{
      channel_login: string;
      market_id: string;
      updated_by_user_id: string;
      updated_at: string;
    }>(
      `SELECT channel_login, market_id, updated_by_user_id, updated_at
       FROM twitch_channel_pins WHERE channel_login = $1 LIMIT 1`,
      [login],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      channelLogin: row.channel_login,
      marketId: row.market_id,
      updatedByUserId: row.updated_by_user_id,
      updatedAt: row.updated_at,
    };
  }

  const row = db
    .prepare(
      `SELECT channel_login, market_id, updated_by_user_id, updated_at
       FROM twitch_channel_pins WHERE channel_login = ? LIMIT 1`,
    )
    .get(login) as
    | {
        channel_login: string;
        market_id: string;
        updated_by_user_id: string;
        updated_at: string;
      }
    | undefined;
  if (!row) return null;
  return {
    channelLogin: row.channel_login,
    marketId: row.market_id,
    updatedByUserId: row.updated_by_user_id,
    updatedAt: row.updated_at,
  };
}
