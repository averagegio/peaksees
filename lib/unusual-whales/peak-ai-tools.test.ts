import { hasPeakPlusTier } from "../membership/plans.ts";
import { looksLikeUnusualWhalesPrompt, peakAiToolStatusLabel } from "../peak-ai/uw-prompt.ts";
import {
  executePeakAiUwTool,
  finalizePeakAiUwReply,
  peakAiUnusualWhalesOpenAiTools,
  UW_TOOL_CATALOG,
  UW_TOOL_NAMES,
} from "./tool-catalog.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

export async function testPeakAiUwToolsAreRegistered() {
  const openaiTools = peakAiUnusualWhalesOpenAiTools();
  const openaiNames = openaiTools.map((tool) => tool.function.name).sort();
  const catalogNames = [...UW_TOOL_NAMES].sort();
  const sharedClientNames = [
    "congress_recent_trades",
    "darkpool_recent",
    "dashboard_snapshot",
    "flow_alerts",
    "market_tide",
    "news_headlines",
    "option_screener",
  ];

  assert(openaiTools.length === 7, "expected 7 Peak AI UW tools");
  assert(
    JSON.stringify(openaiNames) === JSON.stringify(catalogNames),
    `OpenAI tools ${openaiNames.join(",")} !== catalog ${catalogNames.join(",")}`,
  );
  assert(
    JSON.stringify(catalogNames) === JSON.stringify(sharedClientNames),
    `catalog ${catalogNames.join(",")} !== shared client ${sharedClientNames.join(",")}`,
  );
  for (const tool of openaiTools) {
    assert(tool.type === "function", `${tool.function.name} is a function tool`);
    const schema = tool.function.parameters;
    assert(schema && typeof schema === "object", `${tool.function.name} has parameters`);
  }
  const catalogSet = new Set(UW_TOOL_CATALOG.map((t) => t.name));
  for (const name of UW_TOOL_NAMES) {
    assert(catalogSet.has(name), `catalog missing ${name}`);
  }
}

export async function testFreePlanDoesNotCallSharedClient() {
  assert(hasPeakPlusTier("free") === false, "free is not PeakPlus");
  let calls = 0;
  const result = await executePeakAiUwTool({
    name: "flow_alerts",
    args: { ticker: "NVDA", limit: 8 },
    canCallLive: hasPeakPlusTier("free"),
    demoMode: false,
    callTool: async () => {
      calls += 1;
      return [{ ticker: "NVDA", type: "call", strike: "140", expiry: "2026-09-18", premium: 1 }];
    },
  });
  assert(calls === 0, "free plan must not hit the shared Unusual Whales client");
  assert(result.status === "gated", "free plan is gated");
  assert(result.calledLive === false, "calledLive is false");
  assert(/PeakPlus/i.test(result.summary), "gated copy mentions PeakPlus");
  assert(result.prints.length === 0, "no invented prints");
}

export async function testPeakPlusCallsSharedClient() {
  assert(hasPeakPlusTier("peakplus") === true, "peakplus is allowed");
  assert(hasPeakPlusTier("peakpro") === true, "peakpro is allowed");
  let calls = 0;
  let seenName = "";
  const rows = [
    {
      ticker: "NVDA",
      type: "call",
      strike: "140",
      expiry: "2026-09-18",
      premium: 1842500,
    },
    {
      ticker: "SPY",
      type: "put",
      strike: "640",
      expiry: "2026-09-11",
      premium: 962000,
    },
  ];
  const result = await executePeakAiUwTool({
    name: "flow_alerts",
    args: { ticker: "NVDA", limit: 8 },
    canCallLive: hasPeakPlusTier("peakplus"),
    demoMode: false,
    callTool: async (name) => {
      calls += 1;
      seenName = name;
      return rows;
    },
  });
  assert(calls === 1, "PeakPlus must call the shared client once");
  assert(seenName === "flow_alerts", "shared client received flow_alerts");
  assert(result.status === "ok", "PeakPlus path succeeds");
  assert(result.calledLive === true, "calledLive is true");
  assert(result.source === "live", "live source when not demo");
  assert(result.prints.length === 1, "ticker filter keeps NVDA only");
  assert(result.prints[0].includes("NVDA"), "print names NVDA");
  assert(result.prints[0].includes("$1.84M"), "print shows premium like Peakflow cards");
  assert(!result.prints[0].includes("{"), "prints are not raw JSON");
}

export async function testDemoModeLabelsPrints() {
  const result = await executePeakAiUwTool({
    name: "market_tide",
    canCallLive: true,
    demoMode: true,
    callTool: async () => [{ timestamp: "2026-09-04T16:00:00Z", netPremium: 12_400_000 }],
  });
  assert(result.status === "ok", "demo still returns ok");
  assert(result.source === "demo", "demo source");
  assert(/DEMO/i.test(result.note), "note tells Peak AI to say demo");
  assert(result.prints[0].includes("call-heavy"), "tide summarized as call-heavy");

  const reply = finalizePeakAiUwReply("NVDA calls are active.", [result]);
  assert(/demo/i.test(reply), "final reply mentions demo");
  assert(/\/peakflow/i.test(reply), "final reply links Peakflow");
}

export async function testLooksLikeUwPromptAndStatus() {
  assert(looksLikeUnusualWhalesPrompt("what's the flow on NVDA?") === true, "flow prompt");
  assert(looksLikeUnusualWhalesPrompt("dark pool in megacaps") === true, "dark pool");
  assert(looksLikeUnusualWhalesPrompt("any congress trades?") === true, "congress");
  assert(looksLikeUnusualWhalesPrompt("is tide call-heavy?") === true, "tide");
  assert(looksLikeUnusualWhalesPrompt("Will the game go to OT?") === false, "unrelated market");
  assert(
    peakAiToolStatusLabel("@peak what's the flow on NVDA?") === "Checking Unusual Whales…",
    "status row for UW",
  );
  assert(peakAiToolStatusLabel("@peak who wins?") === "Asking Peak AI…", "status row for other");
}

const tests = [
  testPeakAiUwToolsAreRegistered,
  testFreePlanDoesNotCallSharedClient,
  testPeakPlusCallsSharedClient,
  testDemoModeLabelsPrints,
  testLooksLikeUwPromptAndStatus,
];

async function main() {
  let failed = 0;
  for (const test of tests) {
    try {
      await test();
      console.log(`ok  ${test.name}`);
    } catch (err) {
      failed += 1;
      console.error(`fail ${test.name}:`, err instanceof Error ? err.message : err);
    }
  }
  if (failed > 0) {
    console.error(`${failed} failed`);
    process.exit(1);
  }
  console.log(`${tests.length} passed`);
}

void main();
