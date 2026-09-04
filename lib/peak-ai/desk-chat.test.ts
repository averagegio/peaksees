import {
  PEAK_AI_DESK_PLACEHOLDER,
  appendDeskTurn,
  buildPeakAiDeskChatRequest,
  peakAiDeskReplyNeedsPeakflowCta,
  splitPeakAiReplyParts,
} from "./desk-chat.ts";
import { looksLikeUnusualWhalesPrompt, peakAiToolStatusLabel } from "./uw-prompt.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

export async function testDeskChatRequestUsesSharedChatMode() {
  const body = buildPeakAiDeskChatRequest("  NVDA flow  ");
  assert(body.mode === "chat", "desk composer always uses chat mode");
  assert(body.source === "desk", "desk composer marks source=desk");
  assert(body.text === "NVDA flow", "trims the prompt");
  assert(body.query === "NVDA flow", "query matches text");
  assert(
    /ticker or option/i.test(PEAK_AI_DESK_PLACEHOLDER),
    "placeholder mentions ticker or option",
  );
  assert(/NVDA flow/.test(PEAK_AI_DESK_PLACEHOLDER), "placeholder shows NVDA flow");
  assert(/\$140c/.test(PEAK_AI_DESK_PLACEHOLDER), "placeholder shows $140c");
}

export async function testDeskChatPromptDetectsTickerAndOption() {
  assert(looksLikeUnusualWhalesPrompt("NVDA flow") === true, "NVDA flow");
  assert(looksLikeUnusualWhalesPrompt("$140c") === true, "$140c option shorthand");
  assert(looksLikeUnusualWhalesPrompt("TSLA 250p") === true, "ticker + put");
  assert(looksLikeUnusualWhalesPrompt("Will the game go to OT?") === false, "unrelated");
  assert(
    peakAiToolStatusLabel("NVDA flow") === "Checking Unusual Whales…",
    "desk ticker prompt shows UW status",
  );
  assert(
    peakAiToolStatusLabel("$140c") === "Checking Unusual Whales…",
    "option shorthand shows UW status",
  );
}

export async function testDeskChatTurnsAndPeakflowCta() {
  const turns = appendDeskTurn(
    appendDeskTurn([], { role: "user", text: "NVDA flow" }),
    { role: "peak", text: "NVDA $140c exp 2026-09-18 · $1.84M premium · call\n\nOpen Peakflow → /peakflow" },
  );
  assert(turns.length === 2, "keeps user + peak turns");
  assert(turns[0]?.role === "user", "user first");
  assert(turns[1]?.role === "peak", "peak second");

  const many = appendDeskTurn(
    [
      { role: "user", text: "1" },
      { role: "peak", text: "a" },
      { role: "user", text: "2" },
      { role: "peak", text: "b" },
      { role: "user", text: "3" },
      { role: "peak", text: "c" },
    ],
    { role: "user", text: "4" },
    6,
  );
  assert(many.length === 6, "caps history");
  assert(many[0]?.text === "a", "drops oldest");
  assert(many[5]?.text === "4", "keeps newest");

  assert(
    peakAiDeskReplyNeedsPeakflowCta("Open Peakflow → /peakflow", true) === false,
    "no Peakflow CTA when already on /peakflow",
  );
  assert(
    peakAiDeskReplyNeedsPeakflowCta("Unusual Whales tape on NVDA", false) === true,
    "Peak Flow desk shows Open Peakflow",
  );

  const parts = splitPeakAiReplyParts("See /peakflow or /pricing");
  assert(parts.includes("/peakflow"), "splits /peakflow");
  assert(parts.includes("/pricing"), "splits /pricing");
}

const tests = [
  testDeskChatRequestUsesSharedChatMode,
  testDeskChatPromptDetectsTickerAndOption,
  testDeskChatTurnsAndPeakflowCta,
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
