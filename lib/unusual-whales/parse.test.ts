import { createTtlCache, cacheKey } from "./cache.ts";
import { getUnusualWhalesApiKey, isUnusualWhalesDemoMode } from "./config.ts";
import { demoDashboardSnapshot } from "./demo-data.ts";
import { formatCompact, formatUsd } from "./format.ts";
import {
  latestTideBias,
  parseCongress,
  parseDarkPool,
  parseFlowAlerts,
  parseNews,
  parseScreener,
  parseTide,
} from "./parse.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

export async function testParseFlowAlerts() {
  const rows = parseFlowAlerts({
    data: [
      {
        id: "a1",
        ticker: "nvda",
        type: "call",
        expiry: "2026-09-18",
        strike: "140",
        total_premium: "1842500",
        total_size: 4200,
        volume: 9100,
        open_interest: 1800,
        underlying_price: "128.4",
        created_at: "2026-09-04T16:00:00Z",
        option_chain: "NVDA260918C00140000",
        alert_rule: "RepeatedHits",
      },
    ],
  });
  assert(rows.length === 1, "expected 1 flow row");
  assert(rows[0].ticker === "NVDA", "ticker uppercased");
  assert(rows[0].type === "call", "call side");
  assert(rows[0].premium === 1842500, "premium parsed from string");
}

export async function testParseDarkPoolAndCongress() {
  const dp = parseDarkPool({
    data: [{ ticker: "AAPL", price: 10, size: 5, executed_at: "t", venue: "FINRA" }],
  });
  assert(dp[0].notional === 50, "notional = price * size");
  const congress = parseCongress({
    data: [{ full_name: "Ada", ticker: "AMZN", txn_type: "Purchase", amounts: "$1k" }],
  });
  assert(congress[0].politician === "Ada", "politician from full_name");
  assert(congress[0].transaction === "Purchase", "txn_type mapped");
}

export async function testParseTideNewsScreener() {
  const tide = parseTide({
    data: [
      { timestamp: "a", net_call_premium: 5, net_put_premium: 2 },
      { timestamp: "b", net_call_premium: 1, net_put_premium: 8 },
    ],
  });
  assert(tide[0].netPremium === 3, "net premium derived");
  assert(latestTideBias(tide) === "put", "latest bias put");
  const news = parseNews({ headlines: [{ title: "Hello", source: "UW" }] });
  assert(news[0].headline === "Hello", "headline from title");
  const screen = parseScreener({
    results: [{ ticker_symbol: "amd", type: "Calls", premium: 9 }],
  });
  assert(screen[0].ticker === "AMD" && screen[0].type === "call", "screener mapped");
}

export async function testCacheTtlAndKey() {
  const cache = createTtlCache(20);
  cache.set("k", 1);
  assert(cache.get("k") === 1, "cache hit");
  assert(cacheKey("/x", { b: 2, a: 1 }) === "/x?a=1&b=2", "stable cache key");
  await new Promise((r) => setTimeout(r, 30));
  assert(cache.get("k") === undefined, "expired");
}

export async function testDemoSnapshotShape() {
  const snap = demoDashboardSnapshot(new Date("2026-09-04T16:00:00Z"));
  assert(snap.source === "demo", "demo source");
  assert(snap.flow.rows.length >= 1, "flow rows");
  assert(snap.tide.rows.length >= 2, "tide series");
  assert(snap.news.rows[0].source.includes("demo"), "demo news labeled");
}

export async function testFormatUsd() {
  assert(formatUsd(1_840_000) === "$1.84M", "millions");
  assert(formatUsd(962) === "$962", "units");
  assert(formatCompact(4200).length > 0, "compact");
}

export async function testLiveVsDemoEnvContract() {
  const prev = {
    UNUSUAL_WHALES_API_KEY: process.env.UNUSUAL_WHALES_API_KEY,
    UW_API_KEY: process.env.UW_API_KEY,
    UW_DEMO_MODE: process.env.UW_DEMO_MODE,
  };
  const restore = () => {
    for (const [name, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
  try {
    delete process.env.UNUSUAL_WHALES_API_KEY;
    delete process.env.UW_API_KEY;
    delete process.env.UW_DEMO_MODE;
    assert(getUnusualWhalesApiKey() === null, "missing key is null");
    assert(isUnusualWhalesDemoMode() === true, "no key => demo");

    process.env.UNUSUAL_WHALES_API_KEY = "   ";
    assert(getUnusualWhalesApiKey() === null, "whitespace key is ignored");

    process.env.UNUSUAL_WHALES_API_KEY = "test-not-a-real-key";
    assert(isUnusualWhalesDemoMode() === false, "key => live");

    process.env.UW_DEMO_MODE = "true";
    assert(isUnusualWhalesDemoMode() === true, "UW_DEMO_MODE=true forces demo");

    process.env.UW_DEMO_MODE = "false";
    assert(isUnusualWhalesDemoMode() === false, "UW_DEMO_MODE=false keeps live");

    delete process.env.UNUSUAL_WHALES_API_KEY;
    delete process.env.UW_DEMO_MODE;
    process.env.UW_API_KEY = "test-alias-key";
    assert(getUnusualWhalesApiKey() === "test-alias-key", "UW_API_KEY alias");
    assert(isUnusualWhalesDemoMode() === false, "alias key => live");
  } finally {
    restore();
  }
}

const tests = [
  testParseFlowAlerts,
  testParseDarkPoolAndCongress,
  testParseTideNewsScreener,
  testCacheTtlAndKey,
  testDemoSnapshotShape,
  testFormatUsd,
  testLiveVsDemoEnvContract,
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
