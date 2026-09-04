/** Shared Unusual Whales tool list used by Peakflow MCP and Peak AI chat. */

export const UW_TOOL_NAMES = [
  "flow_alerts",
  "darkpool_recent",
  "congress_recent_trades",
  "market_tide",
  "option_screener",
  "news_headlines",
  "dashboard_snapshot",
] as const;

export type UwToolName = (typeof UW_TOOL_NAMES)[number];

export const PEAKFLOW_PATH = "/peakflow";
export const PRICING_PATH = "/pricing";

const TICKER_PROP = {
  ticker: {
    type: "string",
    description:
      "Optional ticker filter such as NVDA. Applied after the shared Unusual Whales client returns.",
  },
} as const;

export const UW_TOOL_CATALOG: Array<{
  name: UwToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}> = [
  {
    name: "flow_alerts",
    description:
      "Unusual options flow alerts from Unusual Whales (volume/OI, premium, call vs put).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 200 },
        ...TICKER_PROP,
      },
    },
  },
  {
    name: "darkpool_recent",
    description: "Recent market-wide dark pool prints.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 200 },
        ...TICKER_PROP,
      },
    },
  },
  {
    name: "congress_recent_trades",
    description: "Recently disclosed congressional stock trades.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 200 },
        ...TICKER_PROP,
      },
    },
  },
  {
    name: "market_tide",
    description: "Market Tide net call vs put premium series (is the tape call-heavy?).",
    inputSchema: { type: "object", properties: { ...TICKER_PROP } },
  },
  {
    name: "option_screener",
    description: "Hottest option contracts screener.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 200 },
        ...TICKER_PROP,
      },
    },
  },
  {
    name: "news_headlines",
    description: "Latest Unusual Whales news headlines.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 50 },
        ...TICKER_PROP,
      },
    },
  },
  {
    name: "dashboard_snapshot",
    description:
      "Combined Peakflow Unusual Whales snapshot (flow, dark pool, congress, tide, screener, news).",
    inputSchema: { type: "object", properties: { ...TICKER_PROP } },
  },
];

export function isUwToolName(name: string): name is UwToolName {
  return (UW_TOOL_NAMES as readonly string[]).includes(name);
}

export function limitFromArgs(args: Record<string, unknown> | undefined, fallback: number): number {
  const raw = args?.limit;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : fallback;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(200, Math.max(1, Math.floor(n)));
}

export function tickerFromArgs(args: Record<string, unknown> | undefined): string | null {
  const raw = args?.ticker;
  if (typeof raw !== "string") return null;
  const ticker = raw.trim().toUpperCase();
  return /^[A-Z.]{1,10}$/.test(ticker) ? ticker : null;
}

/** OpenAI Chat Completions function tools — same names as Peakflow MCP. */
export function peakAiUnusualWhalesOpenAiTools(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return UW_TOOL_CATALOG.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: `${tool.description} Runs server-side through the Peakflow Unusual Whales client.`,
      parameters: tool.inputSchema,
    },
  }));
}

export type PeakAiUwCaller = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

export type PeakAiUwExecuteResult = {
  status: "ok" | "gated" | "error" | "unknown_tool";
  tool: string;
  calledLive: boolean;
  source: "live" | "demo" | null;
  peakflowUrl: typeof PEAKFLOW_PATH;
  pricingUrl: typeof PRICING_PATH;
  tickerFilter: string | null;
  summary: string;
  prints: string[];
  note: string;
};

function money(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
}

function rowTicker(row: Record<string, unknown>): string {
  const raw = row.ticker;
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

function filterRowsByTicker(rows: Record<string, unknown>[], ticker: string | null): Record<string, unknown>[] {
  if (!ticker) return rows;
  return rows.filter((row) => rowTicker(row) === ticker);
}

function optionSuffix(type: unknown): string {
  const v = typeof type === "string" ? type.toLowerCase() : "";
  if (v === "call") return "c";
  if (v === "put") return "p";
  return "";
}

function summarizeFlow(rows: Record<string, unknown>[]): string[] {
  return rows.slice(0, 8).map((row) => {
    const strike = typeof row.strike === "string" ? row.strike : "";
    const expiry = typeof row.expiry === "string" ? row.expiry : "";
    const type = typeof row.type === "string" ? row.type : "unknown";
    const premium = typeof row.premium === "number" ? row.premium : 0;
    return `${rowTicker(row) || "—"} $${strike}${optionSuffix(type)} ${expiry} · ${money(premium)} premium · ${type}`;
  });
}

function summarizeDarkPool(rows: Record<string, unknown>[]): string[] {
  return rows.slice(0, 8).map((row) => {
    const price = typeof row.price === "number" ? row.price : 0;
    const size = typeof row.size === "number" ? row.size : 0;
    const notional = typeof row.notional === "number" ? row.notional : 0;
    const venue = typeof row.venue === "string" ? row.venue : "";
    return `${rowTicker(row) || "—"} · ${size.toLocaleString("en-US")} @ ${money(price)} · ${money(notional)} ${venue}`.trim();
  });
}

function summarizeCongress(rows: Record<string, unknown>[]): string[] {
  return rows.slice(0, 8).map((row) => {
    const politician = typeof row.politician === "string" ? row.politician : "Member";
    const transaction = typeof row.transaction === "string" ? row.transaction : "trade";
    const amount = typeof row.amount === "string" ? row.amount : "";
    return `${politician} ${transaction} ${rowTicker(row) || ""} · ${amount}`.replace(/\s+/g, " ").trim();
  });
}

function summarizeScreener(rows: Record<string, unknown>[]): string[] {
  return rows.slice(0, 8).map((row) => {
    const type = typeof row.type === "string" ? row.type : "unknown";
    const premium = typeof row.premium === "number" ? row.premium : 0;
    const ask = typeof row.askSidePct === "number" ? row.askSidePct : 0;
    return `${rowTicker(row) || "—"} ${type} · ${money(premium)} premium · ${Math.round(ask)}% ask`;
  });
}

function summarizeNews(rows: Record<string, unknown>[]): string[] {
  return rows.slice(0, 6).map((row) => {
    const headline = typeof row.headline === "string" ? row.headline : "Headline";
    const source = typeof row.source === "string" ? row.source : "Unusual Whales";
    return `${headline} — ${source}`;
  });
}

function summarizeTide(rows: Record<string, unknown>[]): string[] {
  const last = rows[rows.length - 1];
  if (!last) return ["No tide ticks"];
  const net = typeof last.netPremium === "number" ? last.netPremium : 0;
  const bias = net > 0 ? "call-heavy" : net < 0 ? "put-heavy" : "flat";
  return [`Tide is ${bias} · net ${money(net)}`];
}

function sectionRows(section: unknown): Record<string, unknown>[] {
  const rec = asRecord(section);
  return rec ? asRows(rec.rows) : [];
}

function applyTickerFilter(name: UwToolName, data: unknown, ticker: string | null): unknown {
  if (!ticker) return data;
  if (Array.isArray(data)) return filterRowsByTicker(asRows(data), ticker);
  if (name !== "dashboard_snapshot") return data;
  const rec = asRecord(data);
  if (!rec) return data;
  const filterSection = (section: unknown) => {
    const s = asRecord(section);
    if (!s) return section;
    return { ...s, rows: filterRowsByTicker(asRows(s.rows), ticker) };
  };
  return {
    ...rec,
    flow: filterSection(rec.flow),
    darkpool: filterSection(rec.darkpool),
    congress: filterSection(rec.congress),
    screener: filterSection(rec.screener),
  };
}

function printsForTool(name: UwToolName, data: unknown): string[] {
  if (name === "dashboard_snapshot") {
    const rec = asRecord(data);
    if (!rec) return [];
    return [
      ...summarizeFlow(sectionRows(rec.flow)).slice(0, 3).map((line) => `Flow: ${line}`),
      ...summarizeDarkPool(sectionRows(rec.darkpool)).slice(0, 2).map((line) => `Dark pool: ${line}`),
      ...summarizeCongress(sectionRows(rec.congress)).slice(0, 2).map((line) => `Congress: ${line}`),
      ...summarizeTide(sectionRows(rec.tide)),
    ];
  }
  const rows = asRows(data);
  if (name === "flow_alerts") return summarizeFlow(rows);
  if (name === "darkpool_recent") return summarizeDarkPool(rows);
  if (name === "congress_recent_trades") return summarizeCongress(rows);
  if (name === "market_tide") return summarizeTide(rows);
  if (name === "option_screener") return summarizeScreener(rows);
  if (name === "news_headlines") return summarizeNews(rows);
  return [];
}

export function executePeakAiUwTool(input: {
  name: string;
  args?: Record<string, unknown>;
  canCallLive: boolean;
  demoMode: boolean;
  callTool: PeakAiUwCaller;
}): Promise<PeakAiUwExecuteResult> {
  const tickerFilter = tickerFromArgs(input.args);

  const base = {
    tool: input.name,
    peakflowUrl: PEAKFLOW_PATH,
    pricingUrl: PRICING_PATH,
    tickerFilter,
  } as const;

  if (!isUwToolName(input.name)) {
    return Promise.resolve({
      ...base,
      status: "unknown_tool",
      calledLive: false,
      source: null,
      summary: `Unknown Unusual Whales tool: ${input.name}`,
      prints: [],
      note: "Do not invent prints.",
    });
  }

  const toolName: UwToolName = input.name;

  if (!input.canCallLive) {
    return Promise.resolve({
      ...base,
      status: "gated",
      calledLive: false,
      source: null,
      summary:
        "PeakPlus or Peakflow is required to pull Unusual Whales from Peak AI. Do not invent live prints.",
      prints: [],
      note: `This member is on a free plan. Explain they need PeakPlus (or higher) / Peakflow. Point them to ${PRICING_PATH} and ${PEAKFLOW_PATH}. The /whales owner token is not a substitute in chat.`,
    });
  }

  const source: "live" | "demo" = input.demoMode ? "demo" : "live";

  return input
    .callTool(toolName, input.args)
    .then((raw) => {
      const data = applyTickerFilter(toolName, raw, tickerFilter);
      const prints = printsForTool(toolName, data);
      const count = prints.length;
      const tickerBit = tickerFilter ? ` for ${tickerFilter}` : "";
      const summary =
        count > 0
          ? `${count} ${toolName.replace(/_/g, " ")} print${count === 1 ? "" : "s"}${tickerBit}`
          : `No matching ${toolName.replace(/_/g, " ")} prints${tickerBit}`;
      const ok: PeakAiUwExecuteResult = {
        ...base,
        status: "ok",
        calledLive: true,
        source,
        summary,
        prints,
        note:
          source === "demo"
            ? "DEMO data — you MUST tell the user these are labeled demo prints, not live Unusual Whales. Summarize the prints; do not dump JSON. End with Open Peakflow → /peakflow."
            : "Summarize these prints like Peakflow cards (ticker, call/put, premium). Do not dump JSON. End with Open Peakflow → /peakflow.",
      };
      return ok;
    })
    .catch((err: unknown) => ({
      ...base,
      status: "error" as const,
      calledLive: true,
      source: input.demoMode ? ("demo" as const) : ("live" as const),
      summary: err instanceof Error ? err.message : "Unusual Whales request failed",
      prints: [],
      note: `Say the desk pull failed and point them to ${PEAKFLOW_PATH}. Do not invent prints.`,
    }));
}

export function inferPeakAiUwTool(text: string): { name: UwToolName; ticker: string | null } {
  const t = text.toLowerCase();
  let name: UwToolName = "flow_alerts";
  if (/\bdark\s*pools?\b/.test(t)) name = "darkpool_recent";
  else if (/\bcongress|senator|representative\b/.test(t)) name = "congress_recent_trades";
  else if (/\btide\b/.test(t)) name = "market_tide";
  else if (/\bscreener\b/.test(t)) name = "option_screener";
  else if (/\bheadlines?|news\b/.test(t)) name = "news_headlines";
  else if (/\bdashboard|snapshot|desk\b/.test(t)) name = "dashboard_snapshot";

  const optionPair = text.match(/\b([A-Za-z]{1,5})\s+\$?\d+(?:\.\d+)?[cp]\b/i);
  const on = text.match(/\bon\s+\$?([A-Za-z.]{1,5})\b/);
  const dollar = text.match(/\$([A-Za-z.]{1,5})\b/);
  const known = text
    .toUpperCase()
    .match(/\b(NVDA|TSLA|AAPL|AMZN|MSFT|META|GOOG|GOOGL|SPY|QQQ|IWM|AMD|CRWD|PLTR|COIN|NFLX)\b/);
  const leading = text.match(/^\s*\$?([A-Za-z]{2,5})\b/);
  const raw = optionPair?.[1] ?? on?.[1] ?? dollar?.[1] ?? known?.[1] ?? leading?.[1] ?? null;
  const ticker = raw && !/^(on|the|is|any|for)$/i.test(raw) ? raw.toUpperCase() : null;
  return { name, ticker };
}

export function formatPeakAiUwDeskNote(result: PeakAiUwExecuteResult): string {
  if (result.status === "gated") {
    return (
      "PeakPlus unlocks live Unusual Whales from Peak AI — flow, dark pool, congress, and tide. " +
      `Upgrade to PeakPlus (or Peakflow) to pull the tape → ${PRICING_PATH}. ` +
      `The full desk is at ${PEAKFLOW_PATH}.`
    );
  }
  if (result.status !== "ok") {
    return `${result.summary} Open Peakflow → ${PEAKFLOW_PATH}`;
  }
  const lines = [
    result.source === "demo" ? "Demo Unusual Whales tape (not live):" : "Unusual Whales tape:",
    result.summary,
    ...result.prints.slice(0, 6).map((line) => `• ${line}`),
    `Open Peakflow for the full desk → ${PEAKFLOW_PATH}`,
  ];
  return lines.join("\n");
}

export async function runPeakAiUwDeskNote(input: {
  userText: string;
  canCallLive: boolean;
  demoMode: boolean;
  callTool: PeakAiUwCaller;
}): Promise<{ reply: string; result: PeakAiUwExecuteResult }> {
  const inferred = inferPeakAiUwTool(input.userText);
  const result = await executePeakAiUwTool({
    name: inferred.name,
    args: inferred.ticker ? { ticker: inferred.ticker } : {},
    canCallLive: input.canCallLive,
    demoMode: input.demoMode,
    callTool: input.callTool,
  });
  return { reply: formatPeakAiUwDeskNote(result), result };
}

export function unusualWhalesMetaFromResults(results: PeakAiUwExecuteResult[]): {
  used: boolean;
  gated: boolean;
  demo: boolean;
  tools: string[];
  peakflowUrl: typeof PEAKFLOW_PATH;
} {
  return {
    used: results.some((r) => r.status === "ok"),
    gated: results.some((r) => r.status === "gated"),
    demo: results.some((r) => r.source === "demo"),
    tools: results.map((r) => r.tool),
    peakflowUrl: PEAKFLOW_PATH,
  };
}

export function finalizePeakAiUwReply(
  reply: string,
  results: PeakAiUwExecuteResult[],
): string {
  let out = reply.trim();
  if (!out) return out;
  const used = results.some((r) => r.status === "ok");
  const gated = results.some((r) => r.status === "gated");
  const demo = results.some((r) => r.source === "demo");

  if (used && !/\/peakflow/i.test(out)) {
    out += "\n\nOpen Peakflow for the full desk → /peakflow";
  }
  if (gated && !/peakplus|\/pricing/i.test(out)) {
    out += "\n\nUpgrade to PeakPlus to pull live Unusual Whales from Peak AI → /pricing";
  }
  if (demo && !/\bdemo\b/i.test(out)) {
    out += "\n\nThese prints are labeled demo — not live Unusual Whales data.";
  }
  return out;
}
