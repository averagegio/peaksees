import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import OpenAI from "openai";

import { openAIMarketModel } from "@/lib/markets/openai-model";
import { listComments } from "@/lib/social/comments-store";

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

/** Rough YES lean from comment thread (bullish vs bearish tokens). */
function commentThreadYesLean(texts: string[]): number | null {
  if (texts.length === 0) return null;
  const yesRe =
    /\b(yes|yep|yeah|bull|bullish|agree|likely|will happen|locks|easy|locks in|definitely|for sure|obviously)\b/i;
  const noRe =
    /\b(no|nah|nope|bear|bearish|disagree|unlikely|never|doubt|fade|against|no chance|overrated)\b/i;
  let yesScore = 0;
  let noScore = 0;
  for (const raw of texts) {
    const t = raw.trim();
    if (!t || /^Peak:/i.test(t)) continue;
    if (yesRe.test(t)) yesScore += 1;
    if (noRe.test(t)) noScore += 1;
  }
  const total = yesScore + noScore;
  if (total === 0) return null;
  return clamp01(yesScore / total);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    text?: string;
    outcomes?: { yes?: number; no?: number };
    query?: string;
    postKey?: string;
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
  const postKey = typeof body.postKey === "string" ? body.postKey.trim() : "";

  let commentYesLean: number | null = null;
  let commentCount = 0;
  if (postKey) {
    try {
      const comments = await listComments({
        postKey,
        viewerUserId: session.user.id,
      });
      commentCount = comments.length;
      commentYesLean = commentThreadYesLean(comments.map((c) => c.text));
    } catch {
      // ignore comment lookup failures
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  const model = openAIMarketModel();
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

  const commentBlurb =
    commentYesLean == null
      ? commentCount > 0
        ? `Comment thread has ${commentCount} replies but no clear YES/NO lean.`
        : "No usable comment-thread sentiment yet."
      : `Comment-thread sentiment leans about ${(commentYesLean * 100).toFixed(0)}% YES across ${commentCount} replies.`;

  if (openaiKey) {
    try {
      const client = new OpenAI({ apiKey: openaiKey });
      const system =
        "You are Peak, a sharp prediction-market assistant. " +
        "Give a probability assessment and a short rationale. " +
        "When comment-section sentiment is one-sided, deliberately offer a dissenting second opinion " +
        "and explain what the crowd/thread may be missing. " +
        "Be concise, avoid financial advice, and clearly state uncertainty.";
      const user =
        `Market text:\n${text}\n\n` +
        `Polling snapshot: YES ${(yes * 100).toFixed(0)}%, NO ${(no * 100).toFixed(0)}%\n\n` +
        `Comment section: ${commentBlurb}\n\n` +
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
            commentYesLean,
            commentCount,
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

  // Heuristic Peak: take the opposite side of comment-thread lean (or crowd) as a second opinion.
  const dissentFrom =
    commentYesLean != null ? commentYesLean : crowdYes;
  // Mirror around 50% with a soft floor/ceiling so Peak isn't 0%/100% absolute.
  const mirrored = 0.5 - (dissentFrom - 0.5) * 1.1;
  const probYes = clamp01(Math.min(0.88, Math.max(0.12, mirrored)));
  const confidence =
    Math.abs(probYes - 0.5) > 0.2
      ? "high"
      : Math.abs(probYes - 0.5) > 0.1
        ? "moderate"
        : "slight";
  const reply =
    commentYesLean != null
      ? `Thread sentiment is running ~${(commentYesLean * 100).toFixed(0)}% YES, but I'd take the other side at about ${(probYes * 100).toFixed(0)}% YES (${confidence} confidence). The comment section looks crowded — watch for new info that could swing the quiet minority.`
      : `Based on current polling (~${(crowdYes * 100).toFixed(0)}% YES), I'd push back to about ${(probYes * 100).toFixed(0)}% YES (${confidence} confidence). Consider what new information could swing the market.`;

  return NextResponse.json({
    reply,
    meta: {
      prob,
      probYes,
      crowdYes,
      commentYesLean,
      commentCount,
      disagree: Math.abs(probYes - crowdYes) >= 0.08,
      used: "heuristic",
      web: Boolean(webSummary),
    },
  });
}
