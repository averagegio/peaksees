import type {
  CongressRow,
  DarkPoolRow,
  FlowAlertRow,
  FlowSide,
  MarketTidePoint,
  NewsRow,
  ScreenerRow,
} from "./types";

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function extractDataArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const rec = asRecord(payload);
  if (!rec) return [];
  for (const key of ["data", "alerts", "trades", "results", "headlines", "items"]) {
    const value = rec[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function str(rec: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function num(rec: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[$,]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function side(raw: string): FlowSide {
  const v = raw.trim().toLowerCase();
  if (v === "call" || v === "calls" || v === "c") return "call";
  if (v === "put" || v === "puts" || v === "p") return "put";
  return "unknown";
}

function idFrom(rec: Record<string, unknown>, fallback: string): string {
  return str(rec, "id", "uuid", "trade_id") || fallback;
}

export function parseFlowAlerts(payload: unknown): FlowAlertRow[] {
  return extractDataArray(payload).flatMap((row, index) => {
    const rec = asRecord(row);
    if (!rec) return [];
    const ticker = str(rec, "ticker", "ticker_symbol", "symbol").toUpperCase();
    if (!ticker) return [];
    return [
      {
        id: idFrom(rec, `flow-${ticker}-${index}`),
        ticker,
        type: side(str(rec, "type", "option_type", "put_call")),
        expiry: str(rec, "expiry", "expiration", "expires_at"),
        strike: str(rec, "strike", "strike_price"),
        premium: num(rec, "total_premium", "premium", "prem"),
        size: num(rec, "total_size", "size"),
        volume: num(rec, "volume"),
        openInterest: num(rec, "open_interest", "oi"),
        underlyingPrice: num(rec, "underlying_price", "spot", "stock_price"),
        createdAt: str(rec, "created_at", "executed_at", "timestamp"),
        optionChain: str(rec, "option_chain", "option_symbol", "option_chain_id"),
        alertRule: str(rec, "alert_rule", "rule_name", "rule"),
      },
    ];
  });
}

export function parseDarkPool(payload: unknown): DarkPoolRow[] {
  return extractDataArray(payload).flatMap((row, index) => {
    const rec = asRecord(row);
    if (!rec) return [];
    const ticker = str(rec, "ticker", "ticker_symbol", "symbol").toUpperCase();
    if (!ticker) return [];
    const price = num(rec, "price", "executed_price");
    const size = num(rec, "size", "volume", "quantity");
    return [
      {
        id: idFrom(rec, `dp-${ticker}-${index}`),
        ticker,
        price,
        size,
        notional: num(rec, "notional", "premium", "market_value") || price * size,
        executedAt: str(rec, "executed_at", "created_at", "timestamp", "date"),
        venue: str(rec, "venue", "exchange", "market_center") || "dark",
      },
    ];
  });
}

export function parseCongress(payload: unknown): CongressRow[] {
  return extractDataArray(payload).flatMap((row, index) => {
    const rec = asRecord(row);
    if (!rec) return [];
    const politician = str(
      rec,
      "politician",
      "full_name",
      "name",
      "representative",
      "senator",
    );
    const ticker = str(rec, "ticker", "ticker_symbol", "symbol").toUpperCase();
    if (!politician && !ticker) return [];
    return [
      {
        id: idFrom(rec, `congress-${ticker || "x"}-${index}`),
        politician: politician || "Unknown",
        ticker: ticker || "—",
        transaction: str(rec, "transaction", "txn_type", "type", "side"),
        amount: str(rec, "amount", "amounts", "amount_range") || String(num(rec, "value")),
        filedAt: str(rec, "filed_at", "transaction_date", "reported_date", "date"),
        chamber: str(rec, "chamber", "house", "office"),
      },
    ];
  });
}

export function parseTide(payload: unknown): MarketTidePoint[] {
  return extractDataArray(payload).flatMap((row, index) => {
    const rec = asRecord(row);
    if (!rec) return [];
    const netCall = num(rec, "net_call_premium", "call_premium", "net_call");
    const netPut = num(rec, "net_put_premium", "put_premium", "net_put");
    return [
      {
        timestamp: str(rec, "timestamp", "date", "time", "created_at") || String(index),
        netCallPremium: netCall,
        netPutPremium: netPut,
        netPremium: num(rec, "net_premium", "net") || netCall - netPut,
      },
    ];
  });
}

export function parseScreener(payload: unknown): ScreenerRow[] {
  return extractDataArray(payload).flatMap((row, index) => {
    const rec = asRecord(row);
    if (!rec) return [];
    const ticker = str(rec, "ticker_symbol", "ticker", "symbol").toUpperCase();
    if (!ticker) return [];
    return [
      {
        id: idFrom(rec, `screen-${ticker}-${index}`),
        ticker,
        optionSymbol: str(rec, "option_symbol", "option_chain", "contract"),
        type: side(str(rec, "type", "option_type")),
        premium: num(rec, "premium", "total_premium", "ask_side_prem"),
        volume: num(rec, "volume", "ask_side_volume"),
        openInterest: num(rec, "open_interest", "oi"),
        askSidePct: num(rec, "ask_side_volume_ratio", "ask_perc", "min_ask_perc"),
      },
    ];
  });
}

export function parseNews(payload: unknown): NewsRow[] {
  return extractDataArray(payload).flatMap((row, index) => {
    const rec = asRecord(row);
    if (!rec) return [];
    const headline = str(rec, "headline", "title", "summary");
    if (!headline) return [];
    return [
      {
        id: idFrom(rec, `news-${index}`),
        headline,
        source: str(rec, "source", "publisher", "site") || "Unusual Whales",
        createdAt: str(rec, "created_at", "published_at", "timestamp"),
        url: str(rec, "url", "link", "href"),
      },
    ];
  });
}

export function latestTideBias(points: MarketTidePoint[]): "call" | "put" | "flat" {
  const last = points[points.length - 1];
  if (!last) return "flat";
  if (last.netPremium > 0) return "call";
  if (last.netPremium < 0) return "put";
  return "flat";
}
