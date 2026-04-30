import { NextResponse } from "next/server";

import OpenAI from "openai";

import { getSession } from "@/lib/auth/session";
import { createMarket, listMarkets } from "@/lib/markets/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const auth = request.headers.get("authorization") ?? "";
  const authedBySecret = secret ? auth === `Bearer ${secret}` : false;
  if (!authedBySecret) {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const session = await getSession();
    const okAdmin =
      Boolean(session) &&
      adminEmails.length > 0 &&
      adminEmails.includes(session!.user.email.toLowerCase());
    if (!okAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!openaiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim();
  const tavilyKey = (process.env.TAVILY_API_KEY ?? "").trim();

  let count = 80;
  try {
    const body = (await request.json().catch(() => ({}))) as { count?: number };
    if (typeof body.count === "number") count = Math.floor(body.count);
  } catch {
    // ignore
  }
  count = Math.max(50, Math.min(100, count));

  const signals = await fetchTrendSignals(tavilyKey);

  const client = new OpenAI({ apiKey: openaiKey });
  const system =
    "You are Peak, an expert prediction-market market maker. " +
    "Generate crisp YES/NO markets that are culturally relevant and time-bounded. " +
    "Do not include slurs, explicit sexual content, or private personal data. " +
    "Questions must be specific and resolve by a date within 90 days.";

  const user =
    `Generate ${count} markets.\n\n` +
    `Signals (culture + news):\n${signals}\n\n` +
    "Return ONLY valid JSON: an array of objects with keys:\n" +
    `- question: string\n- category: string (e.g. Culture, Tech, Sports, News, Politics, Entertainment)\n` +
    `- daysToResolve: number (1..90)\n- yesProbability: number (0.05..0.95)\n` +
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
  const parsed = safeParseJsonArray(raw);
  if (!parsed) {
    return NextResponse.json(
      { error: "Model did not return JSON", sample: raw.slice(0, 500) },
      { status: 502 },
    );
  }

  const existing = await listMarkets({ limit: 200 });
  const existingSet = new Set(existing.map((m) => normalizeQuestion(m.question)));

  const created: Array<{ id: string; question: string }> = [];
  for (const item of parsed) {
    const question = typeof item.question === "string" ? item.question.trim() : "";
    const category = typeof item.category === "string" ? item.category.trim() : "Culture";
    const daysToResolve = Math.floor(Number(item.daysToResolve ?? 30));
    const yesProbability = Number(item.yesProbability ?? 0.5);
    if (question.length < 8) continue;
    if (daysToResolve < 1 || daysToResolve > 90) continue;
    if (!Number.isFinite(yesProbability) || yesProbability < 0.05 || yesProbability > 0.95)
      continue;

    const norm = normalizeQuestion(question);
    if (existingSet.has(norm)) continue;

    const endsAt = new Date(Date.now() + daysToResolve * 24 * 60 * 60 * 1000).toISOString();
    const m = await createMarket({
      question,
      category: category.slice(0, 24),
      endsAt,
      source: "peak_daily",
      yesProbability,
    });
    existingSet.add(norm);
    created.push({ id: m.id, question: m.question });
  }

  return NextResponse.json({ ok: true, createdCount: created.length, created });
}

async function fetchTrendSignals(tavilyKey: string) {
  const queries = [
    "what is trending on X today",
    "tiktok trending topics today",
    "top news headlines today",
    "pop culture trending stories today",
  ];

  const chunks: string[] = [];
  for (const q of queries) {
    const out = await tavilySummary(tavilyKey, q);
    if (out) chunks.push(`- ${q}:\n${out}`);
  }
  if (chunks.length > 0) return chunks.join("\n\n").slice(0, 3500);

  // Fallback if Tavily not configured.
  return [
    "- Use broad cultural topics (music, film, tech launches, sports, elections).",
    "- Prefer near-term resolution (7-60 days).",
  ].join("\n");
}

async function tavilySummary(tavilyKey: string, query: string) {
  if (!tavilyKey) return "";
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: "basic",
        max_results: 6,
        include_answer: true,
      }),
    });
    const j = (await r.json()) as { answer?: string };
    return typeof j.answer === "string" ? j.answer.slice(0, 900) : "";
  } catch {
    return "";
  }
}

type GeneratedMarket = {
  question?: unknown;
  category?: unknown;
  daysToResolve?: unknown;
  yesProbability?: unknown;
};

function safeParseJsonArray(raw: string): GeneratedMarket[] | null {
  try {
    const val = JSON.parse(raw);
    if (!Array.isArray(val)) return null;
    return val as GeneratedMarket[];
  } catch {
    return null;
  }
}

function normalizeQuestion(q: string) {
  return q.toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s?%$.-]/g, "").trim();
}

