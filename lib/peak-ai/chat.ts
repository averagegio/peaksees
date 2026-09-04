import type OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import {
  executePeakAiUwTool,
  finalizePeakAiUwReply,
  peakAiUnusualWhalesOpenAiTools,
  type PeakAiUwCaller,
  type PeakAiUwExecuteResult,
} from "@/lib/unusual-whales/tool-catalog";

const MAX_TOOL_STEPS = 4;

export function peakAiChatSystemPrompt(input: {
  canCallUw: boolean;
  demoMode: boolean;
  planLabel: string;
}): string {
  return [
    "You are Peak, Peak AI on Peaksees.",
    "Members @peak you in comments when they want a tape read or a market take.",
    "You can pull Unusual Whales through tools: flow_alerts, darkpool_recent, congress_recent_trades, market_tide, option_screener, news_headlines, dashboard_snapshot.",
    "Typical asks: what's the flow on NVDA, dark pool in megacaps, any congress trades, is tide call-heavy.",
    "When the question is about options flow, dark pool, congress, tide, screeners, or the tape, call the matching tool.",
    "Never dump raw JSON. Write a short desk note: ticker, call/put, strike/expiry if present, premium — like Peakflow cards.",
    "Always end Unusual Whales answers with: Open Peakflow for the full desk → /peakflow",
    input.canCallUw
      ? `This member is on ${input.planLabel}. Unusual Whales tools are allowed.`
      : `This member is on ${input.planLabel}. If they ask for Unusual Whales, you may invoke the tool (it will refuse live data) then explain they need PeakPlus / Peakflow. Do not invent prints. The /whales owner token is not required and does not unlock chat.`,
    input.demoMode
      ? "Tools may return labeled DEMO data. If source is demo, you MUST say the prints are demo, not live."
      : "Tools return live Unusual Whales data, cached like Peakflow (~45 seconds).",
    "Not financial advice. Stay concise.",
  ].join(" ");
}

function functionToolCalls(message: {
  tool_calls?: Array<{
    id: string;
    type: string;
    function?: { name?: string; arguments?: string };
  }> | null;
}): Array<{ id: string; name: string; arguments: string }> {
  return (message.tool_calls ?? []).flatMap((call) => {
    if (call.type !== "function" || !call.function?.name) return [];
    return [
      {
        id: call.id,
        name: call.function.name,
        arguments: call.function.arguments ?? "{}",
      },
    ];
  });
}

function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore malformed model JSON
  }
  return {};
}

export async function runPeakAiChat(input: {
  client: OpenAI;
  model: string;
  userText: string;
  query?: string;
  webSummary?: string;
  canCallUw: boolean;
  demoMode: boolean;
  planLabel: string;
  callTool: PeakAiUwCaller;
}): Promise<{
  reply: string;
  unusualWhales: {
    used: boolean;
    gated: boolean;
    demo: boolean;
    tools: string[];
    peakflowUrl: "/peakflow";
  };
}> {
  const tools = peakAiUnusualWhalesOpenAiTools() as ChatCompletionTool[];
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: peakAiChatSystemPrompt({
        canCallUw: input.canCallUw,
        demoMode: input.demoMode,
        planLabel: input.planLabel,
      }),
    },
    {
      role: "user",
      content:
        (input.query && input.query !== input.userText
          ? `Market / thread: ${input.query}\n\n`
          : "") +
        `Member message:\n${input.userText}\n\n` +
        (input.webSummary ? `Web summary:\n${input.webSummary}\n\n` : "") +
        "If this is an Unusual Whales question, use a tool. Then answer in a short desk note.",
    },
  ];

  const results: PeakAiUwExecuteResult[] = [];

  for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
    const resp = await input.client.chat.completions.create({
      model: input.model,
      temperature: 0.4,
      messages,
      tools,
      tool_choice: "auto",
    });

    const message = resp.choices[0]?.message;
    if (!message) break;

    const calls = functionToolCalls(message);
    if (calls.length === 0) {
      const reply = finalizePeakAiUwReply(message.content?.trim() || "", results);
      return {
        reply,
        unusualWhales: summarizeUwMeta(results),
      };
    }

    messages.push({
      role: "assistant",
      content: message.content,
      tool_calls: message.tool_calls ?? [],
    });

    for (const call of calls) {
      const result = await executePeakAiUwTool({
        name: call.name,
        args: parseToolArgs(call.arguments),
        canCallLive: input.canCallUw,
        demoMode: input.demoMode,
        callTool: input.callTool,
      });
      results.push(result);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply: finalizePeakAiUwReply(
      "I pulled the tape — open Peakflow for the full desk → /peakflow",
      results,
    ),
    unusualWhales: summarizeUwMeta(results),
  };
}

function summarizeUwMeta(results: PeakAiUwExecuteResult[]): {
  used: boolean;
  gated: boolean;
  demo: boolean;
  tools: string[];
  peakflowUrl: "/peakflow";
} {
  return {
    used: results.some((r) => r.status === "ok"),
    gated: results.some((r) => r.status === "gated"),
    demo: results.some((r) => r.source === "demo"),
    tools: results.map((r) => r.tool),
    peakflowUrl: "/peakflow",
  };
}
