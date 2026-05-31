import "server-only";

import OpenAI from "openai";

import type { Market, MarketSide } from "@/lib/markets/store";
import { openAIMarketModel } from "@/lib/markets/openai-model";

export async function determineMarketOutcome(market: Market): Promise<MarketSide> {
  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  const model = openAIMarketModel();
  const tavilyKey = (process.env.TAVILY_API_KEY ?? "").trim();

  if (!openaiKey) {
    return fallbackOutcome(market);
  }

  const evidence = await fetchResolutionEvidence(tavilyKey, market.question);
  const today = new Date().toISOString().slice(0, 10);

  try {
    const client = new OpenAI({ apiKey: openaiKey });
    const resp = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You resolve YES/NO prediction markets based on real-world outcomes as of the resolution date. " +
            "Return JSON only: {\"outcome\":\"yes\"|\"no\",\"confidence\":number,\"reason\":string}. " +
            "Use yes when the event clearly happened or condition is met; otherwise no.",
        },
        {
          role: "user",
          content:
            `Today: ${today}\n` +
            `Market end date: ${market.endsAt}\n` +
            `Question: ${market.question}\n` +
            `Category: ${market.category}\n\n` +
            `Evidence:\n${evidence}\n\n` +
            "Resolve this market now.",
        },
      ],
    });

    const raw = resp.choices[0]?.message?.content ?? "";
    const parsed = safeParseObject(raw);
    const outcome = parsed?.outcome;
    if (outcome === "yes" || outcome === "no") return outcome;
    return fallbackOutcome(market);
  } catch {
    return fallbackOutcome(market);
  }
}

function fallbackOutcome(market: Market): MarketSide {
  return market.yesProbability >= 0.5 ? "yes" : "no";
}

async function fetchResolutionEvidence(tavilyKey: string, question: string) {
  if (!tavilyKey) {
    return "- No live search configured; resolve from the question wording and today's date.";
  }
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: `${question} outcome result`,
        search_depth: "basic",
        max_results: 6,
        include_answer: true,
      }),
    });
    const j = (await r.json()) as { answer?: string; results?: Array<{ content?: string }> };
    const parts: string[] = [];
    if (typeof j.answer === "string" && j.answer.trim()) {
      parts.push(j.answer.trim().slice(0, 1200));
    }
    for (const hit of j.results ?? []) {
      if (typeof hit.content === "string" && hit.content.trim()) {
        parts.push(hit.content.trim().slice(0, 400));
      }
    }
    return parts.length ? parts.join("\n\n").slice(0, 2500) : "- No search hits.";
  } catch {
    return "- Search failed; use question text only.";
  }
}

function safeParseObject(raw: string): { outcome?: unknown } | null {
  try {
    const val = JSON.parse(raw) as { outcome?: unknown };
    return val && typeof val === "object" ? val : null;
  } catch {
    return null;
  }
}
