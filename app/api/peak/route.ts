import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import OpenAI from "openai";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function extractProbYesFromText(text: string): number | null {
  // Try to find a probability in the model output.
  // Accept forms like "62%", "62 %", "P=0.62", "0.62", "62 percent".
  const t = text.toLowerCase();

  // Prefer explicit percents.
  const percentMatches = [...t.matchAll(/(\d{1,3}(?:\.\d+)?)\s*(%|percent)\b/g)];
  for (const m of percentMatches) {
    const raw = Number(m[1]);
    if (!Number.isFinite(raw)) continue;
    if (raw < 0 || raw > 100) continue;
    return clamp01(raw / 100);
  }

  // Then look for 0..1 decimals (e.g. 0.62) only if it appears probability-ish.
  // Keep it conservative to avoid grabbing unrelated numbers (years, counts, etc).
  const decimalMatches = [...t.matchAll(/\b(?:p\s*=\s*)?(0?\.\d{1,3}|1\.0{1,3}|0|1)\b/g)];
  for (const m of decimalMatches) {
    const raw = Number(m[1]);
    if (!Number.isFinite(raw)) continue;
    if (raw < 0 || raw > 1) continue;
    return clamp01(raw);
  }

  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    text?: string;
    outcomes?: { yes?: number; no?: number };
    query?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const yes = clamp01(Number(body.outcomes?.yes ?? 0.55));
  const no = clamp01(Number(body.outcomes?.no ?? 1 - yes));
  const prob = clamp01((yes + (1 - no)) / 2);
  const crowdYes = yes;

  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const tavilyKey = process.env.TAVILY_API_KEY ?? "";

  // Optional live web pull via Tavily (fast, simple).
  let webSummary = "";
  const query = (body.query ?? text).slice(0, 240).trim();
  if (tavilyKey && query) {
    try {
      const r = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: "basic",
          max_results: 4,
          include_answer: true,
        }),
      });
      const j = (await r.json()) as { answer?: string };
      if (typeof j.answer === "string") webSummary = j.answer.slice(0, 800);
    } catch {
      // ignore
    }
  }

  if (openaiKey) {
    try {
      const client = new OpenAI({ apiKey: openaiKey });
      const system =
        "You are Peak, a sharp prediction-market assistant. " +
        "Give a probability assessment and a short rationale. " +
        "Be concise, avoid financial advice, and clearly state uncertainty.";
      const user =
        `Market text:\n${text}\n\n` +
        `Polling snapshot: YES ${(yes * 100).toFixed(0)}%, NO ${(no * 100).toFixed(0)}%\n\n` +
        (webSummary ? `Web summary:\n${webSummary}\n\n` : "") +
        "Reply with 2-4 sentences and include an updated % estimate.";

      const resp = await client.chat.completions.create({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const reply = resp.choices[0]?.message?.content?.trim() || "";
      if (reply) {
        const modelProbYes = extractProbYesFromText(reply);
        const probYes = modelProbYes ?? prob;
        return NextResponse.json({
          reply,
          meta: {
            prob,
            probYes,
            crowdYes,
            disagree: Math.abs(probYes - crowdYes) >= 0.08,
            used: "openai",
            model,
            web: Boolean(webSummary),
          },
        });
      }
    } catch {
      // fall through to heuristic
    }
  }

  const confidence =
    prob > 0.66 ? "high" : prob > 0.55 ? "moderate" : prob > 0.48 ? "slight" : "low";
  const reply =
    `Based on current polling, I'd put this at about ${(prob * 100).toFixed(0)}% ` +
    `(${confidence} confidence). Consider what new information could swing the market.`;

  return NextResponse.json({
    reply,
    meta: {
      prob,
      probYes: prob,
      crowdYes,
      disagree: Math.abs(prob - crowdYes) >= 0.08,
      used: "heuristic",
      web: Boolean(webSummary),
    },
  });
}

