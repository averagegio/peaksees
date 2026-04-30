import { NextResponse } from "next/server";

import OpenAI from "openai";

import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  if (!openaiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }
  const model = (process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim();
  const tavilyKey = (process.env.TAVILY_API_KEY ?? "").trim();

  let seed = "";
  try {
    const body = (await request.json().catch(() => ({}))) as { seed?: string };
    seed = typeof body.seed === "string" ? body.seed.slice(0, 220) : "";
  } catch {
    // ignore
  }

  const web = await maybeWebPrompt(tavilyKey);
  const client = new OpenAI({ apiKey: openaiKey });
  const system =
    "You are Peak, an engaging social prediction-market assistant. " +
    "Suggest a single post idea (a 'peak') that is timely and debate-provoking. " +
    "Keep it short, specific, and phrased as a YES/NO market question. " +
    "No private data, no slurs, no explicit sexual content.";
  const user =
    `User seed (optional): ${seed || "(none)"}\n\n` +
    (web ? `Today signals:\n${web}\n\n` : "") +
    "Return ONLY the suggested peak text (one sentence).";

  const resp = await client.chat.completions.create({
    model,
    temperature: 0.8,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const suggestion = resp.choices[0]?.message?.content?.trim() ?? "";
  if (!suggestion) {
    return NextResponse.json({ error: "No suggestion available" }, { status: 502 });
  }
  return NextResponse.json({ suggestion: suggestion.slice(0, 240) });
}

async function maybeWebPrompt(tavilyKey: string) {
  if (!tavilyKey) return "";
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: "today's biggest pop culture + news trends",
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
      }),
    });
    const j = (await r.json()) as { answer?: string };
    return typeof j.answer === "string" ? j.answer.slice(0, 800) : "";
  } catch {
    return "";
  }
}

