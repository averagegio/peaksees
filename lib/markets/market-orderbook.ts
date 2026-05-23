import "server-only";

import { Pool } from "pg";

import { db } from "@/lib/db";
import { normalizeMarketId } from "@/lib/markets/id";
import type { MarketOrderbookPayload, OrderbookLevel } from "@/lib/markets/orderbook-types";
import { getMarketById } from "@/lib/markets/store";

export type { MarketOrderbookPayload, MarketSpread, OrderbookLevel } from "@/lib/markets/orderbook-types";

const postgresUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
const postgresPool = postgresUrl
  ? new Pool({
      connectionString: postgresUrl,
      ssl: postgresUrl.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    })
  : null;

type AggRow = {
  side: string;
  price_cents: number;
  shares_x1000: number;
  orders: number;
};

function clampPriceCents(n: number) {
  if (!Number.isFinite(n)) return 50;
  return Math.min(99, Math.max(1, Math.floor(n)));
}

function sharesFromX1000(v: number) {
  return Math.round(v / 10) / 100;
}

async function aggregateTradeLevels(marketId: string): Promise<Map<string, AggRow>> {
  const map = new Map<string, AggRow>();

  if (postgresPool) {
    const result = await postgresPool.query<AggRow>(
      `SELECT side, price_cents,
              SUM(shares_x1000)::int AS shares_x1000,
              COUNT(*)::int AS orders
       FROM market_trades
       WHERE market_id = $1
       GROUP BY side, price_cents
       ORDER BY price_cents DESC`,
      [marketId],
    );
    for (const row of result.rows) {
      map.set(`${row.side}:${row.price_cents}`, row);
    }
    return map;
  }

  const rows = db
    .prepare(
      `SELECT side, price_cents,
              SUM(shares_x1000) AS shares_x1000,
              COUNT(*) AS orders
       FROM market_trades
       WHERE market_id = ?
       GROUP BY side, price_cents
       ORDER BY price_cents DESC`,
    )
    .all(marketId) as AggRow[];

  for (const row of rows) {
    map.set(`${row.side}:${row.price_cents}`, row);
  }
  return map;
}

function syntheticLevels(midCents: number, side: "yes" | "no"): {
  bids: OrderbookLevel[];
  asks: OrderbookLevel[];
} {
  const mid = clampPriceCents(midCents);
  const offsets = [0, 2, 4, 6];
  const sizes = [120, 85, 60, 40];
  const bids: OrderbookLevel[] = [];
  const asks: OrderbookLevel[] = [];
  for (let i = 0; i < offsets.length; i++) {
    const bid = clampPriceCents(mid - offsets[i] - (i === 0 ? 1 : 0));
    const ask = clampPriceCents(mid + offsets[i] + (i === 0 ? 1 : 0));
    bids.push({
      priceCents: bid,
      sizeShares: sizes[i]! + (side === "yes" ? 10 : 0),
      orders: 3 + i,
    });
    asks.push({
      priceCents: ask,
      sizeShares: sizes[i]! + (side === "no" ? 8 : 0),
      orders: 2 + i,
    });
  }
  return { bids, asks };
}

function levelsFromAgg(
  agg: Map<string, AggRow>,
  side: "yes" | "no",
  midCents: number,
): { bids: OrderbookLevel[]; asks: OrderbookLevel[] } {
  const levels: OrderbookLevel[] = [];
  for (const row of agg.values()) {
    if (row.side !== side) continue;
    levels.push({
      priceCents: row.price_cents,
      sizeShares: sharesFromX1000(Number(row.shares_x1000)),
      orders: Number(row.orders),
    });
  }
  if (levels.length === 0) return syntheticLevels(midCents, side);

  levels.sort((a, b) => b.priceCents - a.priceCents);
  const mid = clampPriceCents(midCents);
  const bids = levels.filter((l) => l.priceCents <= mid).slice(0, 5);
  const asks = levels.filter((l) => l.priceCents > mid).slice(0, 5);
  if (bids.length === 0 || asks.length === 0) {
    const synth = syntheticLevels(mid, side);
    return {
      bids: bids.length ? bids : synth.bids,
      asks: asks.length ? asks : synth.asks,
    };
  }
  return { bids, asks };
}

function buildSpread(yesMid: number, yesBook: { bids: OrderbookLevel[]; asks: OrderbookLevel[] }) {
  const yesBidCents = yesBook.bids[0]?.priceCents ?? clampPriceCents(yesMid - 2);
  const yesAskCents = yesBook.asks[0]?.priceCents ?? clampPriceCents(yesMid + 2);
  const noBidCents = clampPriceCents(100 - yesAskCents);
  const noAskCents = clampPriceCents(100 - yesBidCents);
  return {
    yesBidCents,
    yesAskCents,
    noBidCents,
    noAskCents,
    spreadCents: Math.max(1, yesAskCents - yesBidCents),
  };
}

export async function getMarketOrderbook(
  marketIdInput: string,
): Promise<MarketOrderbookPayload | null> {
  const marketId = normalizeMarketId(marketIdInput);
  if (!marketId || marketId.startsWith("pending:")) return null;

  const market = await getMarketById(marketId);
  if (!market) return null;

  const yesMid = clampPriceCents(Math.round(Number(market.yesProbability) * 100));
  const noMid = clampPriceCents(100 - yesMid);
  const agg = await aggregateTradeLevels(marketId);
  const yes = levelsFromAgg(agg, "yes", yesMid);
  const no = levelsFromAgg(agg, "no", noMid);

  return {
    marketId,
    midYesCents: yesMid,
    spread: buildSpread(yesMid, yes),
    yes,
    no,
    updatedAt: new Date().toISOString(),
  };
}
