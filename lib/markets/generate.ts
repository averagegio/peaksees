import "server-only";

import { Pool } from "pg";
import OpenAI from "openai";

import { db } from "@/lib/db";
import { createMarket, listMarkets } from "@/lib/markets/store";

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
}): Promise<{ generated: number }> {
  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!openaiKey) return { generated: 0 };
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim();
  const tavilyKey = (process.env.TAVILY_API_KEY ?? "").trim();
  const category =
    typeof input.category === "string" && input.category.trim()
      ? input.category.trim().slice(0, 24)
      : "";

  const count = Math.max(1, Math.min(10, Math.floor(input.count)));
  const since = new Date(Date.now() - input.minIntervalMs).toISOString();
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayStartIso = dayStart.toISOString();

  const sourcePrefix = category ? `peak_${category.toLowerCase()}_` : "peak_";
  const recentCount = await countMarkets({ sinceIso: since, sourcePrefix });
  if (recentCount > 0) return { generated: 0 };

  const todayCount = await countMarkets({ sinceIso: dayStartIso, sourcePrefix });
  if (todayCount >= input.dailyCap) return { generated: 0 };

  const signals = await fetchTrendSignals({ tavilyKey, category: category || undefined });
  const client = new OpenAI({ apiKey: openaiKey });

  const system =
    "You are Peak, an expert prediction-market market maker. " +
    "Generate crisp YES/NO markets that are culturally relevant and time-bounded. " +
    "No slurs, explicit sexual content, or private personal data. " +
    "Questions must be specific and resolve within 90 days. " +
    "Never generate generic questions; each market must be anchored to a concrete, timely signal.";

  const user =
    `Generate ${count} markets.\n\n` +
    (category
      ? `Category: ${category}. Every item MUST use exactly this category value.\n\n`
      : "") +
    `Signals:\n${signals}\n\n` +
    "Rules:\n" +
    "- Every question MUST clearly tie to a specific signal above (headline/event/person/product/release/match).\n" +
    "- Avoid vague templates like “Will inflation go down” or “Will a celebrity do X” without a named event.\n" +
    "- Use proper nouns where appropriate.\n" +
    "- Resolution within 90 days (daysToResolve 1..90).\n\n" +
    "Return ONLY valid JSON: an array of objects with keys:\n" +
    `- question: string\n- category: string\n- daysToResolve: number (1..90)\n- yesProbability: number (0.05..0.95)\n` +
    "No markdown, no extra text.";

  const resp = await client.chat.completions.create({
    model,
    temperature: 0.7,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const raw = resp.choices[0]?.message?.content ?? "";
  const parsed = safeParse(raw);
  if (!parsed) return { generated: 0 };

  const existing = await listMarkets({ limit: 200, category: category || undefined });
  const existingSet = new Set(existing.map((m) => normalizeQuestion(m.question)));

  let createdCount = 0;
  for (const item of parsed) {
    const question = typeof item.question === "string" ? item.question.trim() : "";
    const rawCategory = typeof item.category === "string" ? item.category.trim() : "Culture";
    const finalCategory = category || rawCategory || "Culture";
    const daysToResolve = Math.floor(Number(item.daysToResolve ?? 30));
    const yesProbability = Number(item.yesProbability ?? 0.5);
    if (question.length < 8) continue;
    if (daysToResolve < 1 || daysToResolve > 90) continue;
    if (!Number.isFinite(yesProbability) || yesProbability < 0.05 || yesProbability > 0.95)
      continue;

    const norm = normalizeQuestion(question);
    if (existingSet.has(norm)) continue;

    const endsAt = new Date(Date.now() + daysToResolve * 24 * 60 * 60 * 1000).toISOString();
    await createMarket({
      question,
      category: finalCategory.slice(0, 24),
      endsAt,
      source: category ? `peak_${category.toLowerCase()}_refresh` : "peak_refresh",
      yesProbability,
    });
    existingSet.add(norm);
    createdCount += 1;
  }

  return { generated: createdCount };
}

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

async function fetchTrendSignals(input: { tavilyKey: string; category?: string }) {
  const { tavilyKey } = input;
  if (!tavilyKey) return "- Tavily not configured. Set TAVILY_API_KEY for current events.";

  const category = (input.category ?? "").trim();
  const now = new Date().toISOString().slice(0, 10);
  const baseQueries = [
    `top breaking headlines today ${now}`,
    `what is trending on X today ${now}`,
    `what is trending on TikTok today ${now}`,
  ];
  const categoryQuery =
    category === "News"
      ? [`major political and economic headlines today ${now}`]
      : category === "Sports"
        ? [`sports schedule + injuries + playoffs updates today ${now}`]
        : category === "Culture"
          ? [`pop culture trends music movies creators drama today ${now}`]
          : [];

  const queries = [...baseQueries, ...categoryQuery];
  const chunks: string[] = [];
  for (const q of queries) {
    const chunk = await tavilySearchToSignals({ tavilyKey, query: q });
    chunks.push(`Query: ${q}\n${chunk}`);
  }
  return chunks.join("\n\n").slice(0, 2200);
}

async function tavilySearchToSignals(input: { tavilyKey: string; query: string }) {
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: input.tavilyKey,
        query: input.query,
        search_depth: "advanced",
        max_results: 8,
        include_answer: true,
        include_images: false,
        include_raw_content: false,
      }),
    });
    const j = (await r.json()) as {
      answer?: string;
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };
    const lines: string[] = [];
    if (typeof j.answer === "string" && j.answer.trim()) {
      lines.push(j.answer.trim().slice(0, 650));
    }
    const results = Array.isArray(j.results) ? j.results.slice(0, 6) : [];
    if (results.length) {
      lines.push("Sources:");
      for (const it of results) {
        const title = typeof it.title === "string" ? it.title.trim() : "";
        const url = typeof it.url === "string" ? it.url.trim() : "";
        if (!title && !url) continue;
        lines.push(`- ${title || url}${url ? ` (${url})` : ""}`.slice(0, 220));
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
  daysToResolve?: unknown;
  yesProbability?: unknown;
};

function safeParse(raw: string): GenItem[] | null {
  try {
    const val = JSON.parse(raw);
    if (!Array.isArray(val)) return null;
    return val as GenItem[];
  } catch {
    return null;
  }
}

function normalizeQuestion(q: string) {
  return q.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s?%$.-]/g, "").trim();
}

