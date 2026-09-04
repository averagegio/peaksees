import "server-only";

import { UW_API_BASE, UW_CACHE_TTL_MS, UW_CLIENT_API_ID, getUnusualWhalesApiKey, isUnusualWhalesDemoMode } from "./config";
import { cacheKey, createTtlCache } from "./cache";
import { demoDashboardSnapshot } from "./demo-data";
import {
  parseCongress,
  parseDarkPool,
  parseFlowAlerts,
  parseNews,
  parseScreener,
  parseTide,
} from "./parse";
import type {
  CongressRow,
  DarkPoolRow,
  DashboardSection,
  DashboardSnapshot,
  FlowAlertRow,
  MarketTidePoint,
  NewsRow,
  ScreenerRow,
} from "./types";

const cache = createTtlCache(UW_CACHE_TTL_MS);

export class UnusualWhalesError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "UnusualWhalesError";
    this.status = status;
  }
}

type Query = Record<string, string | number | boolean | undefined>;

async function uwGet(path: string, query: Query = {}): Promise<unknown> {
  const key = getUnusualWhalesApiKey();
  if (!key) {
    throw new UnusualWhalesError("Unusual Whales API key is not configured", 503);
  }

  const keyName = cacheKey(path, query);
  const cached = cache.get<unknown>(keyName);
  if (cached !== undefined) return cached;

  const url = new URL(path, UW_API_BASE);
  for (const [name, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(name, String(value));
  }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "UW-CLIENT-API-ID": UW_CLIENT_API_ID,
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: text.slice(0, 240) };
    }
  }

  if (!res.ok) {
    const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const message =
      (typeof rec?.error === "string" && rec.error) ||
      (typeof rec?.message === "string" && rec.message) ||
      `Unusual Whales request failed (${res.status})`;
    throw new UnusualWhalesError(message, res.status);
  }

  cache.set(keyName, body);
  return body;
}

async function section<T>(
  loader: () => Promise<T[]>,
): Promise<DashboardSection<T>> {
  try {
    return { ok: true, error: null, rows: await loader() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return { ok: false, error: message, rows: [] };
  }
}

function demoSlice<T>(rows: T[], limit: number): T[] {
  return rows.slice(0, Math.min(rows.length, Math.max(1, limit)));
}

export async function fetchFlowAlerts(limit = 40): Promise<FlowAlertRow[]> {
  if (isUnusualWhalesDemoMode()) {
    return demoSlice(demoDashboardSnapshot().flow.rows, limit);
  }
  const payload = await uwGet("/api/option-trades/flow-alerts", {
    limit,
    unusual: true,
  });
  return parseFlowAlerts(payload);
}

export async function fetchDarkPoolRecent(limit = 30): Promise<DarkPoolRow[]> {
  if (isUnusualWhalesDemoMode()) {
    return demoSlice(demoDashboardSnapshot().darkpool.rows, limit);
  }
  const payload = await uwGet("/api/darkpool/recent", { limit });
  return parseDarkPool(payload);
}

export async function fetchCongressRecent(limit = 25): Promise<CongressRow[]> {
  if (isUnusualWhalesDemoMode()) {
    return demoSlice(demoDashboardSnapshot().congress.rows, limit);
  }
  const payload = await uwGet("/api/congress/recent-trades", { limit });
  return parseCongress(payload);
}

export async function fetchMarketTide(): Promise<MarketTidePoint[]> {
  if (isUnusualWhalesDemoMode()) {
    return demoDashboardSnapshot().tide.rows;
  }
  const payload = await uwGet("/api/market/market-tide", { interval_5m: true });
  return parseTide(payload);
}

export async function fetchOptionScreener(limit = 25): Promise<ScreenerRow[]> {
  if (isUnusualWhalesDemoMode()) {
    return demoSlice(demoDashboardSnapshot().screener.rows, limit);
  }
  const payload = await uwGet("/api/screener/option-contracts", {
    limit,
    min_premium: 100000,
  });
  return parseScreener(payload);
}

export async function fetchNewsHeadlines(limit = 15): Promise<NewsRow[]> {
  if (isUnusualWhalesDemoMode()) {
    return demoSlice(demoDashboardSnapshot().news.rows, limit);
  }
  const payload = await uwGet("/api/news/headlines", { limit });
  return parseNews(payload);
}

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (isUnusualWhalesDemoMode()) {
    return demoDashboardSnapshot();
  }

  const [flow, darkpool, congress, tide, screener, news] = await Promise.all([
    section(() => fetchFlowAlerts()),
    section(() => fetchDarkPoolRecent()),
    section(() => fetchCongressRecent()),
    section(() => fetchMarketTide()),
    section(() => fetchOptionScreener()),
    section(() => fetchNewsHeadlines()),
  ]);

  return {
    source: "live",
    generatedAt: new Date().toISOString(),
    flow,
    darkpool,
    congress,
    tide,
    screener,
    news,
  };
}

export const unusualWhalesTools = {
  flow_alerts: fetchFlowAlerts,
  darkpool_recent: fetchDarkPoolRecent,
  congress_recent_trades: fetchCongressRecent,
  market_tide: fetchMarketTide,
  option_screener: fetchOptionScreener,
  news_headlines: fetchNewsHeadlines,
  dashboard_snapshot: fetchDashboardSnapshot,
} as const;
