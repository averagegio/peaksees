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

  const signals = await fetchTrendSignals(tavilyKey);
  const client = new OpenAI({ apiKey: openaiKey });

  const system =
    "You are Peak, an expert prediction-market market maker. " +
    "Generate crisp YES/NO markets that are culturally relevant and time-bounded. " +
    "No slurs, explicit sexual content, or private personal data. " +
    "Questions must be specific and resolve within 90 days.";

  const user =
    `Generate ${count} markets.\n\n` +
    (category
      ? `Category: ${category}. Every item MUST use exactly this category value.\n\n`
      : "") +
    `Signals:\n${signals}\n\n` +
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

async function fetchTrendSignals(tavilyKey: string) {
  if (!tavilyKey) return "- Use broad cultural topics across X, TikTok, and major news.";
  const q = "today's top culture + news trends across X, TikTok, and headlines";
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: q,
        search_depth: "basic",
        max_results: 8,
        include_answer: true,
      }),
    });
    const j = (await r.json()) as { answer?: string };
    return typeof j.answer === "string" ? j.answer.slice(0, 1200) : "- Trends unavailable.";
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

