import { NextResponse } from "next/server";

import OpenAI from "openai";

import { isAdminRequest } from "@/lib/auth/admin";
import { fetchTrendSignals } from "@/lib/markets/generate";
import {
  forwardLookingMarketRules,
  isRetroactiveMarketQuestion,
  isTemplatedMarketQuestion,
  isVagueMarketQuestion,
  marketGenerationDateContext,
  scoreMarketQuestionFocus,
  sharpMarketQuestionGuide,
} from "@/lib/markets/generation-guard";
import { openAIMarketModel } from "@/lib/markets/openai-model";
import { createMarket, listMarkets } from "@/lib/markets/store";

export const runtime = "nodejs";

function clampCount(raw: number) {
  const envDefault = Math.floor(Number(process.env.CRON_MARKET_COUNT ?? "24"));
  const count = Math.floor(raw);
  const fallback = Number.isFinite(envDefault) ? envDefault : 24;
  if (!Number.isFinite(count)) return fallback;
  return Math.max(12, Math.min(40, count));
}

async function runGenerateMarkets(count: number) {
  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!openaiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }
  const model = openAIMarketModel();
  const tavilyKey = (process.env.TAVILY_API_KEY ?? "").trim();

  const signals = await fetchTrendSignals({ tavilyKey });
  const dateCtx = marketGenerationDateContext();

  const client = new OpenAI({ apiKey: openaiKey });
  const system =
    "You are Peak, an expert prediction-market market maker. " +
    "Generate crisp YES/NO markets that are culturally relevant and time-bounded. " +
    "Headline-style titles (Polymarket/Kalshi), not repetitive Will-by-date templates. " +
    "Do not include slurs, explicit sexual content, or private personal data. " +
    "Questions must be specific and resolve by a date within 90 days.\n\n" +
    forwardLookingMarketRules() +
    "\n\n" +
    sharpMarketQuestionGuide();

  const askCount = Math.min(count + 8, 36);
  const user =
    `Generate ${askCount} candidate markets; return all in JSON (we keep the sharpest ${count}).\n` +
    `Reference date: ${dateCtx.todayIso} (UTC).\n\n` +
    `Signals (culture + news):\n${signals}\n\n` +
    "Rules:\n" +
    "- SKIP signals about events that already finished; only forward-looking uncertain outcomes.\n" +
    "- Each question must still be open as of the reference date.\n\n" +
    'Return ONLY valid JSON: {"markets":[...]} where each item has keys:\n' +
    `- question: string\n- category: string (e.g. Culture, Tech, Sports, News, Politics, Entertainment)\n` +
    `- daysToResolve: number (1..90)\n- yesProbability: number (0.05..0.95)\n` +
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
  if (!parsed) {
    return NextResponse.json(
      { error: "Model did not return JSON", sample: raw.slice(0, 500) },
      { status: 502 },
    );
  }

  const existing = await listMarkets({ limit: 200 });
  const existingSet = new Set(existing.map((m) => normalizeQuestion(m.question)));

  type Draft = {
    question: string;
    category: string;
    subcategory: string;
    hashtags: string[];
    daysToResolve: number;
    yesProbability: number;
    focusScore: number;
  };
  const drafts: Draft[] = [];

  for (const item of parsed) {
    const question = typeof item.question === "string" ? item.question.trim() : "";
    const category = typeof item.category === "string" ? item.category.trim() : "Culture";
    const daysToResolve = Math.floor(Number(item.daysToResolve ?? 30));
    const yesProbability = Number(item.yesProbability ?? 0.5);
    if (question.length < 8) continue;
    if (isRetroactiveMarketQuestion(question)) continue;
    if (isTemplatedMarketQuestion(question)) continue;
    if (isVagueMarketQuestion(question)) continue;
    if (daysToResolve < 1 || daysToResolve > 90) continue;
    if (!Number.isFinite(yesProbability) || yesProbability < 0.05 || yesProbability > 0.95)
      continue;

    const norm = normalizeQuestion(question);
    if (existingSet.has(norm)) continue;

    drafts.push({
      question,
      category,
      subcategory:
        typeof item.subcategory === "string" ? item.subcategory.trim().slice(0, 32) : "",
      hashtags: Array.isArray(item.hashtags)
        ? item.hashtags
            .filter((t) => typeof t === "string")
            .map((t) => (t as string).trim())
            .filter((t) => /^#[^\s#]{2,32}$/.test(t))
            .slice(0, 6)
        : [],
      daysToResolve,
      yesProbability,
      focusScore: scoreMarketQuestionFocus(question),
    });
  }

  drafts.sort((a, b) => b.focusScore - a.focusScore);

  const created: Array<{ id: string; question: string }> = [];
  for (const d of drafts) {
    if (created.length >= count) break;
    const endsAt = new Date(Date.now() + d.daysToResolve * 24 * 60 * 60 * 1000).toISOString();
    const m = await createMarket({
      question: d.question,
      category: d.category.slice(0, 24),
      subcategory: d.subcategory,
      hashtags: d.hashtags,
      endsAt,
      source: "peak_daily",
      yesProbability: d.yesProbability,
    });
    existingSet.add(normalizeQuestion(d.question));
    created.push({ id: m.id, question: m.question });
  }

  return NextResponse.json({ ok: true, createdCount: created.length, created });
}

/** Vercel Cron invokes GET with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const count = clampCount(Number(url.searchParams.get("count") ?? 80));
  return runGenerateMarkets(count);
}

export async function POST(request: Request) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let count = 80;
  try {
    const body = (await request.json().catch(() => ({}))) as { count?: number };
    if (typeof body.count === "number") count = body.count;
  } catch {
    // ignore
  }
  return runGenerateMarkets(clampCount(count));
}

type GeneratedMarket = {
  question?: unknown;
  category?: unknown;
  subcategory?: unknown;
  hashtags?: unknown;
  daysToResolve?: unknown;
  yesProbability?: unknown;
};

function safeParseMarketsPayload(raw: string): GeneratedMarket[] | null {
  try {
    const val = JSON.parse(raw) as unknown;
    if (Array.isArray(val)) return val as GeneratedMarket[];
    if (val && typeof val === "object" && Array.isArray((val as { markets?: unknown }).markets)) {
      return (val as { markets: GeneratedMarket[] }).markets;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeQuestion(q: string) {
  return q.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s?%$.-]/g, "").trim();
}

