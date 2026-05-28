import "server-only";

import { Pool } from "pg";
import OpenAI from "openai";

import { db } from "@/lib/db";
import {
  forwardLookingMarketRules,
  isRetroactiveMarketQuestion,
  isVagueMarketQuestion,
  marketGenerationDateContext,
  scoreMarketQuestionFocus,
  sharpMarketQuestionGuide,
} from "@/lib/markets/generation-guard";
import { createMarket, listMarkets, type Market } from "@/lib/markets/store";

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
async function ensureSchema() {
  if (!postgresPool) return;
  if (!schemaReady) {
    schemaReady = postgresPool
      .query(`
        CREATE TABLE IF NOT EXISTS markets (
          id TEXT PRIMARY KEY,
          question TEXT NOT NULL,
          category TEXT NOT NULL,
          ends_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          source TEXT NOT NULL,
          yes_probability REAL NOT NULL,
          no_probability REAL NOT NULL,
          volume_cents INTEGER NOT NULL DEFAULT 0
        );
      `)
      .then(() => undefined);
  }
  await schemaReady;
}

export async function maybeGenerateMarketsOnRefresh(input: {
  count: number;
  minIntervalMs: number;
  dailyCap: number;
  category?: string;
  subcategory?: string;
  tz?: string;
}): Promise<{ generated: number }> {
  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!openaiKey) return { generated: 0 };
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim();
  const tavilyKey = (process.env.TAVILY_API_KEY ?? "").trim();
  let category =
    typeof input.category === "string" && input.category.trim()
      ? input.category.trim().slice(0, 24)
      : "";
  let requestedSubcategory =
    typeof input.subcategory === "string" && input.subcategory.trim()
      ? input.subcategory.trim().slice(0, 32)
      : "";
  if (requestedSubcategory.toLowerCase() === "anime") {
    if (!category) category = "Anime";
    requestedSubcategory = "";
  }
  const tz =
    typeof input.tz === "string" && input.tz.trim()
      ? input.tz.trim().slice(0, 64)
      : "";

  const count = Math.max(1, Math.min(6, Math.floor(input.count)));
  const askCount = Math.min(8, count + 2);
  const since = new Date(Date.now() - input.minIntervalMs).toISOString();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();

  const sourcePrefix = category
    ? `peak_${category.toLowerCase()}_refresh`
    : "peak_refresh";
  const recentCount = await countMarkets({ sinceIso: since, sourcePrefix });
  if (recentCount > 0) return { generated: 0 };

  const todayCount = await countMarkets({ sinceIso: dayStartIso, sourcePrefix });
  if (todayCount >= input.dailyCap) return { generated: 0 };

  const signals = await fetchTrendSignals({
    tavilyKey,
    category: category || undefined,
    tz: tz || undefined,
  });
  const client = new OpenAI({ apiKey: openaiKey });

  const allowed = allowedSubcategories(category);
  const forcedSubcategory =
    requestedSubcategory && allowed.includes(requestedSubcategory)
      ? requestedSubcategory
      : "";

  const dateCtx = marketGenerationDateContext();
  const system =
    "You are Peak, an expert prediction-market market maker. " +
    "Generate crisp YES/NO markets that are culturally relevant and time-bounded. " +
    "No slurs, explicit sexual content, or private personal data. " +
    "Questions must be specific and resolve within 90 days. " +
    "Every market must be anchored to a concrete, timely signal.\n\n" +
    forwardLookingMarketRules() +
    "\n\n" +
    sharpMarketQuestionGuide();

  const user =
    `Generate ${askCount} candidate markets; only return your ${count} sharpest ideas in JSON (we rank by specificity).\n` +
    `Reference date: ${dateCtx.todayIso} (UTC).\n\n` +
    (category
      ? `Category: ${category}. Every item MUST use exactly this category value.\n\n`
      : "") +
    (forcedSubcategory
      ? `Subcategory: ${forcedSubcategory}. Every item MUST use exactly this subcategory value.\n\n`
      : allowed.length
        ? `Allowed subcategories for ${category}: ${allowed.join(", ")}.\n\n`
        : "") +
    `Signals:\n${signals}\n\n` +
    "Rules:\n" +
    "- Each market MUST reference a named event/person/team/product mentioned in the signals.\n" +
    "- SKIP any signal about an event that already finished; only trade on what is still undecided.\n" +
    "- Provide subcategory and hashtags that match the nav category.\n" +
    "- Hashtags: 3..6 tags, each starts with #, no spaces.\n\n" +
    'Return ONLY valid JSON: {"markets":[...]} where each item has keys:\n' +
    `- question: string\n- category: string\n- subcategory: string\n- hashtags: string[]\n- daysToResolve: number (1..90)\n- yesProbability: number (0.05..0.95)\n` +
    "No markdown, no extra text.";

  const resp = await client.chat.completions.create({
    model,
    temperature: 0.35,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "";
  const parsed = safeParseMarketsPayload(raw);
  if (!parsed) return { generated: 0 };

  const existing = await listMarkets({ limit: 200, category: category || undefined });
  const existingSet = new Set(existing.map((m) => normalizeQuestion(m.question)));

  const createdCount = await persistRankedFeedMarkets({
    items: parsed,
    maxCreate: count,
    category,
    forcedSubcategory,
    allowedSubcategories: allowed,
    existingSet,
    source: category ? `peak_${category.toLowerCase()}_refresh` : "peak_refresh",
  });

  return { generated: createdCount };
}

/** Turn a user peak into a tradeable market card (single fast OpenAI call, no Tavily). */
export async function generateMarketFromPeak(input: {
  peakId: string;
  text: string;
}): Promise<Market | null> {
  const text = input.text.trim().slice(0, 280);
  if (text.length < 4) return null;

  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim();
  const fallback = heuristicMarketFromPeak(text);

  if (!openaiKey) {
    return createMarket({
      question: fallback.question,
      category: fallback.category,
      hashtags: fallback.hashtags,
      endsAt: fallback.endsAt,
      source: `peak_post:${input.peakId}`,
      yesProbability: fallback.yesProbability,
    });
  }

  try {
    const client = new OpenAI({ apiKey: openaiKey });
    const resp = await client.chat.completions.create({
      model,
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Convert social posts into YES/NO prediction market questions. " +
            "Be specific, time-bounded (1-90 days), no slurs or private data. " +
            forwardLookingMarketRules() +
            "\n" +
            sharpMarketQuestionGuide() +
            ' Return JSON: {"question":string,"category":string,"daysToResolve":number,"yesProbability":number,"hashtags":string[]}',
        },
        {
          role: "user",
          content:
            `Today: ${marketGenerationDateContext().todayIso} (UTC).\n` +
            `Post:\n${text}\n\n` +
            "Return one forward-looking market as JSON (not about an event that already happened).",
        },
      ],
    });
    const raw = resp.choices[0]?.message?.content ?? "";
    const parsed = safeParseObject(raw);
    let question =
      typeof parsed?.question === "string" && parsed.question.trim().length >= 8
        ? parsed.question.trim().slice(0, 240)
        : fallback.question;
    if (isRetroactiveMarketQuestion(question) || isVagueMarketQuestion(question)) {
      question = fallback.question;
    }
    const rawCategory =
      typeof parsed?.category === "string" ? parsed.category.trim() : fallback.category;
    const category = rawCategory.slice(0, 24) || "Culture";
    const daysToResolve = Math.floor(Number(parsed?.daysToResolve ?? 30));
    const days = daysToResolve >= 1 && daysToResolve <= 90 ? daysToResolve : 30;
    const yesProbability = Number(parsed?.yesProbability ?? 0.5);
    const yesP =
      Number.isFinite(yesProbability) && yesProbability >= 0.05 && yesProbability <= 0.95
        ? yesProbability
        : 0.5;
    const hashtags = Array.isArray(parsed?.hashtags)
      ? (parsed.hashtags as unknown[])
          .filter((t) => typeof t === "string")
          .map((t) => String(t).trim())
          .filter((t) => /^#[^\s#]{2,32}$/.test(t))
          .slice(0, 6)
      : fallback.hashtags;
    const endsAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    return createMarket({
      question,
      category,
      hashtags: hashtags.length ? hashtags : fallback.hashtags,
      endsAt,
      source: `peak_post:${input.peakId}`,
      yesProbability: yesP,
    });
  } catch {
    return createMarket({
      question: fallback.question,
      category: fallback.category,
      hashtags: fallback.hashtags,
      endsAt: fallback.endsAt,
      source: `peak_post:${input.peakId}`,
      yesProbability: fallback.yesProbability,
    });
  }
}

function heuristicMarketFromPeak(text: string) {
  let question = text.trim();
  if (!/[?]$/.test(question)) {
    question = `Will this happen: ${question.slice(0, 200)}?`;
  }
  return {
    question: question.slice(0, 240),
    category: "Culture",
    hashtags: ["#peak"],
    yesProbability: 0.5,
    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

type TrendCacheEntry = { at: number; signals: string };
const trendSignalCache = new Map<string, TrendCacheEntry>();
const TREND_CACHE_MS = 5 * 60_000;

async function countMarkets(input: { sinceIso: string; sourcePrefix: string }) {
  if (postgresPool) {
    await ensureSchema();
    const result = await postgresPool.query<{ c: string }>(
      `SELECT COUNT(*)::text as c
       FROM markets
       WHERE created_at >= $1 AND source LIKE $2`,
      [input.sinceIso, `${input.sourcePrefix}%`],
    );
    return Number(result.rows[0]?.c ?? 0);
  }

  const row = db
    .prepare(
      `SELECT COUNT(*) as c
       FROM markets
       WHERE created_at >= ? AND source LIKE ?`,
    )
    .get(input.sinceIso, `${input.sourcePrefix}%`) as { c: number };
  return Number(row?.c ?? 0);
}

export async function fetchTrendSignals(input: { tavilyKey: string; category?: string; tz?: string }) {
  const key = (input.tavilyKey ?? "").trim();
  if (!key) return "- Tavily not configured. Set TAVILY_API_KEY for current events.";

  const category = (input.category ?? "").trim();
  const tz = (input.tz ?? "").trim();
  const now = new Date().toISOString().slice(0, 10);
  const cacheKey = `${now}:${category}:${tz}`;
  const cached = trendSignalCache.get(cacheKey);
  if (cached && Date.now() - cached.at < TREND_CACHE_MS) {
    return cached.signals;
  }

    const baseQueries = [
      `top breaking headlines and emerging narratives ${now}`,
      `viral trending topics and rising angles ${now}${tz ? ` ${tz}` : ""}`,
      `ongoing stories likely to evolve in the next 30–60 days ${now}`,
      `signals, risks, and deadlines journalists and analysts are watching ${now}`,
    ];
  const categoryQueries =
    category === "News"
      ? [`geopolitics and macro headlines today ${now}`]
      : category === "Sports"
        ? [`sports matchups injuries today ${now}`]
        : category === "Culture"
          ? [`pop culture trending music movies creators today ${now}`]
          : category === "Anime"
            ? [`anime releases episodes seasonal trends announcements ${now}`, `manga adaptations anime industry news ${now}`]
            : [];

  const queries = [...baseQueries, ...categoryQueries];
  const chunks = await Promise.all(
    queries.map(async (q) => `Query: ${q}\n${await tavilySignals(key, q)}`),
  );
  const signals = chunks.join("\n\n").slice(0, 2400);
  trendSignalCache.set(cacheKey, { at: Date.now(), signals });
  return signals;
}

function allowedSubcategories(category: string): string[] {
  if (category === "News") {
    return ["politics", "econ", "global", "eu", "tech", "science", "commodities", "ai"];
  }
  if (category === "Sports") {
    return ["nba", "nfl", "wnba", "soccer", "hockey", "golf", "olympics", "niche"];
  }
  if (category === "Culture") {
    return ["celebs", "fashion", "music", "events", "local", "tv", "streaming", "netflix", "art"];
  }
  if (category === "Anime") {
    return ["manga", "animation", "industry", "releases", "fandoms", "streaming", "adaptations", "events"];
  }
  return [];
}

async function tavilySignals(key: string, query: string) {
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: 4,
        include_answer: true,
        include_images: false,
        include_raw_content: false,
      }),
    });
    const j = (await r.json()) as {
      answer?: string;
      results?: Array<{ title?: string; url?: string }>;
    };
    const lines: string[] = [];
    if (typeof j.answer === "string" && j.answer.trim()) {
      lines.push(j.answer.trim().slice(0, 420));
    }
    const results = Array.isArray(j.results) ? j.results.slice(0, 5) : [];
    if (results.length) {
      lines.push("Sources:");
      for (const it of results) {
        const t = typeof it.title === "string" ? it.title.trim() : "";
        const u = typeof it.url === "string" ? it.url.trim() : "";
        if (!t && !u) continue;
        lines.push(`- ${t || u}${u ? ` (${u})` : ""}`.slice(0, 220));
      }
    }
    return lines.join("\n").trim() || "- No signals.";
  } catch {
    return "- Trends unavailable.";
  }
}

type GenItem = {
  question?: unknown;
  category?: unknown;
  subcategory?: unknown;
  hashtags?: unknown;
  daysToResolve?: unknown;
  yesProbability?: unknown;
};

function safeParseMarketsPayload(raw: string): GenItem[] | null {
  try {
    const val = JSON.parse(raw) as unknown;
    if (Array.isArray(val)) return val as GenItem[];
    if (val && typeof val === "object" && Array.isArray((val as { markets?: unknown }).markets)) {
      return (val as { markets: GenItem[] }).markets;
    }
    return null;
  } catch {
    return null;
  }
}

type RankedMarketDraft = {
  question: string;
  finalCategory: string;
  subcategory: string;
  hashtags: string[];
  daysToResolve: number;
  yesProbability: number;
  focusScore: number;
};

async function persistRankedFeedMarkets(input: {
  items: GenItem[];
  maxCreate: number;
  category: string;
  forcedSubcategory: string;
  allowedSubcategories: string[];
  existingSet: Set<string>;
  source: string;
}): Promise<number> {
  const drafts: RankedMarketDraft[] = [];

  for (const item of input.items) {
    const question = typeof item.question === "string" ? item.question.trim() : "";
    const rawCategory = typeof item.category === "string" ? item.category.trim() : "Culture";
    const finalCategory = input.category || rawCategory || "Culture";
    const rawSubcategory =
      typeof item.subcategory === "string" ? item.subcategory.trim() : "";
    const subcategory =
      input.forcedSubcategory ||
      (input.allowedSubcategories.length
        ? input.allowedSubcategories.includes(rawSubcategory)
          ? rawSubcategory
          : ""
        : rawSubcategory);
    const hashtags = Array.isArray(item.hashtags)
      ? item.hashtags
          .filter((t) => typeof t === "string")
          .map((t) => String(t).trim())
          .filter((t) => /^#[^\s#]{2,32}$/.test(t))
          .slice(0, 6)
      : [];
    const daysToResolve = Math.floor(Number(item.daysToResolve ?? 30));
    const yesProbability = Number(item.yesProbability ?? 0.5);

    if (question.length < 8) continue;
    if (isRetroactiveMarketQuestion(question)) continue;
    if (isVagueMarketQuestion(question)) continue;
    if (daysToResolve < 1 || daysToResolve > 90) continue;
    if (!Number.isFinite(yesProbability) || yesProbability < 0.05 || yesProbability > 0.95) {
      continue;
    }
    if (input.allowedSubcategories.length && !input.forcedSubcategory && !subcategory) {
      continue;
    }

    const norm = normalizeQuestion(question);
    if (input.existingSet.has(norm)) continue;

    drafts.push({
      question,
      finalCategory,
      subcategory,
      hashtags,
      daysToResolve,
      yesProbability,
      focusScore: scoreMarketQuestionFocus(question),
    });
  }

  drafts.sort((a, b) => b.focusScore - a.focusScore);

  let createdCount = 0;
  for (const d of drafts) {
    if (createdCount >= input.maxCreate) break;
    const endsAt = new Date(Date.now() + d.daysToResolve * 24 * 60 * 60 * 1000).toISOString();
    await createMarket({
      question: d.question,
      category: d.finalCategory.slice(0, 24),
      subcategory: d.subcategory,
      hashtags: d.hashtags,
      endsAt,
      source: input.source,
      yesProbability: d.yesProbability,
    });
    input.existingSet.add(normalizeQuestion(d.question));
    createdCount += 1;
  }

  return createdCount;
}

/** Min ms between feed-triggered autogen batches (env override for faster refresh). */
export function feedAutogenMinIntervalMs(): number {
  const raw = Number(process.env.FEED_AUTOGEN_MIN_INTERVAL_MS ?? 30_000);
  if (!Number.isFinite(raw)) return 30_000;
  return Math.max(15_000, Math.min(120_000, Math.floor(raw)));
}

function safeParseObject(raw: string): GenItem | null {
  try {
    const val = JSON.parse(raw);
    if (!val || typeof val !== "object" || Array.isArray(val)) return null;
    return val as GenItem;
  } catch {
    return null;
  }
}

function normalizeQuestion(q: string) {
  return q.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s?%$.-]/g, "").trim();
}

