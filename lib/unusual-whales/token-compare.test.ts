import { getPersonalAccessToken, getUnusualWhalesApiKey } from "./config.ts";
import { normalizeAccessToken, tokensMatch } from "./token-compare.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

export async function testNormalizeTrimsAndStripsQuotes() {
  assert(normalizeAccessToken("  abc  ") === "abc", "trim whitespace");
  assert(normalizeAccessToken("abc\n") === "abc", "trim trailing newline");
  assert(normalizeAccessToken("\r\nabc\t") === "abc", "trim crlf/tab");
  assert(normalizeAccessToken('"abc"') === "abc", "strip double quotes");
  assert(normalizeAccessToken("'abc'") === "abc", "strip single quotes");
  assert(normalizeAccessToken('  "abc"  \n') === "abc", "trim then strip quotes");
}

export async function testTokensMatchWhitespace() {
  assert(tokensMatch("secret", "secret") === true, "exact match");
  assert(tokensMatch("  secret  ", "secret") === true, "provided whitespace");
  assert(tokensMatch("secret", "  secret\n") === true, "expected whitespace");
  assert(tokensMatch("secret\n", "\tsecret ") === true, "both sides whitespace");
  assert(tokensMatch('"secret"', "secret") === true, "quoted provided");
}

export async function testTokensMatchMismatch() {
  assert(tokensMatch("secret", "Secret") === false, "case sensitive");
  assert(tokensMatch("secret", "secret-2") === false, "different values");
  assert(tokensMatch("secret", "secre") === false, "prefix is not a match");
  assert(tokensMatch("", "secret") === false, "empty provided");
  assert(tokensMatch("secret", "") === false, "empty expected");
  assert(tokensMatch("   ", "secret") === false, "whitespace-only provided");
  assert(tokensMatch("wrong", "secret") === false, "unrelated token");
}

export async function testPersonalTokenNotTheApiKey() {
  const prev = {
    UW_PERSONAL_ACCESS_TOKEN: process.env.UW_PERSONAL_ACCESS_TOKEN,
    UNUSUAL_WHALES_API_KEY: process.env.UNUSUAL_WHALES_API_KEY,
    UW_API_KEY: process.env.UW_API_KEY,
  };
  const restore = () => {
    for (const [name, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
  try {
    process.env.UW_PERSONAL_ACCESS_TOKEN = "  owner-desk-token\n";
    process.env.UNUSUAL_WHALES_API_KEY = "uw-api-key-value";
    delete process.env.UW_API_KEY;

    const personal = getPersonalAccessToken();
    const apiKey = getUnusualWhalesApiKey();
    assert(personal === "owner-desk-token", "personal token trimmed from env");
    assert(apiKey === "uw-api-key-value", "api key present");
    assert(tokensMatch("owner-desk-token", personal ?? "") === true, "personal unlock");
    assert(tokensMatch("uw-api-key-value", personal ?? "") === false, "api key is not unlock");
    assert(tokensMatch("  owner-desk-token\n", personal ?? "") === true, "pasted personal with ws");
    assert(tokensMatch('"owner-desk-token"', personal ?? "") === true, "quoted paste still matches");

    process.env.UW_PERSONAL_ACCESS_TOKEN = "";
    assert(getPersonalAccessToken() === null, "unset personal token");
  } finally {
    restore();
  }
}

const tests = [
  testNormalizeTrimsAndStripsQuotes,
  testTokensMatchWhitespace,
  testTokensMatchMismatch,
  testPersonalTokenNotTheApiKey,
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
