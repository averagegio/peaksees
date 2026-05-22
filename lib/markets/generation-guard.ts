import "server-only";

/** UTC date context injected into market-generation prompts. */
export function marketGenerationDateContext(now = new Date()) {
  const todayIso = now.toISOString().slice(0, 10);
  return {
    todayIso,
    year: now.getUTCFullYear(),
    nowIso: now.toISOString(),
  };
}

/** Shared rules so models avoid markets about events that already happened. */
export function forwardLookingMarketRules(now = new Date()): string {
  const { todayIso, year } = marketGenerationDateContext(now);
  return [
    `Today is ${todayIso} (UTC).`,
    "Only create markets about outcomes that are still OPEN and uncertain as of today.",
    "Do NOT create markets about events that already finished (completed games, past elections, announced winners, released products, historical facts).",
    'Phrase every question in forward-looking form ("Will…", "By [future date]…", "Before…").',
    `Do not anchor questions to calendar years before ${year}.`,
    "If a signal describes something that already occurred, skip it or reframe to a related FUTURE outcome (next game, next vote, next release).",
    "Prefer resolution windows 7–45 days ahead unless the news cites a specific later deadline.",
  ].join("\n");
}

/**
 * Heuristic filter: drop questions that read like past / already-resolved events.
 * Models still slip through without this even with prompt rules.
 */
export function isRetroactiveMarketQuestion(question: string, now = new Date()): boolean {
  const q = question.trim();
  if (q.length < 8) return true;

  const lower = q.toLowerCase();
  const year = now.getUTCFullYear();

  if (
    /\b(did |was the |were the |has already|have already|already won|already lost|already happened|already released|final score|game ended|match ended|election results)\b/i.test(
      lower,
    )
  ) {
    return true;
  }

  if (/\b(last night|yesterday|last week|last month|last year|earlier today|earlier this week)\b/i.test(lower)) {
    return true;
  }

  const yearMatches = q.match(/\b(?:19|20)\d{2}\b/g);
  if (yearMatches) {
    for (const ym of yearMatches) {
      const y = Number(ym);
      if (Number.isFinite(y) && y >= 1990 && y < year) return true;
    }
  }

  return false;
}

const VAGUE_PATTERNS: RegExp[] = [
  /\bwill (ai|crypto|things|it|this|that|technology|the world|the economy|the market|markets in general)\b/i,
  /\b(someone|something|somewhere|everyone|people|folks|stuff)\b/i,
  /\b(get better|get worse|go up|go down|change everything|make a difference|be successful)\b/i,
  /\b(major|significant|big|huge|massive) (shift|change|impact|effect)\b/i,
  /\bbecome (popular|famous|successful|mainstream)\b/i,
  /\bwill there be (more|less|any)\b/i,
];

/** 0–100; higher = more specific / tradable wording. */
export function scoreMarketQuestionFocus(question: string): number {
  const q = question.trim();
  if (!q || isRetroactiveMarketQuestion(q)) return 0;

  let score = 42;
  if (q.length >= 48 && q.length <= 220) score += 14;
  if (q.length < 36) score -= 18;

  if (/\b(by|before|on or before|no later than)\s+/i.test(q)) score += 12;
  if (
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
      q,
    )
  ) {
    score += 8;
  }
  if (/\b\d{1,2}[\/-]\d{1,2}|\bQ[1-4]\b|\b\d+%\b|\$[\d,]+/i.test(q)) score += 10;

  const words = q.split(/\s+/);
  let proper = 0;
  for (const w of words) {
    if (/^[A-Z][a-z]{2,}/.test(w) && !/^(Will|By|Before|Does|Is|The|A|An|In|On|At)$/.test(w)) {
      proper += 1;
    }
  }
  if (proper >= 2) score += 22;
  else if (proper === 1) score += 10;
  else score -= 20;

  if (!/\?/.test(q)) score -= 12;
  for (const re of VAGUE_PATTERNS) {
    if (re.test(q)) score -= 14;
  }

  return Math.max(0, Math.min(100, score));
}

export function isVagueMarketQuestion(question: string, minScore = 58): boolean {
  return scoreMarketQuestionFocus(question) < minScore;
}

/** Prompt block with concrete good vs bad examples. */
export function sharpMarketQuestionGuide(): string {
  return [
    "Question quality bar (strict):",
    '- GOOD: "Will the Fed cut rates by at least 25bp before July 31, 2026?"',
    '- GOOD: "Will Netflix renew Squid Game for a third season before Dec 31, 2026?"',
    '- BAD: "Will AI change everything?" / "Will crypto go up?" / "Will things improve?"',
    "Every question MUST name a specific entity (person, company, team, bill, index, show) and one checkable outcome with an implicit or explicit deadline.",
    "Ban vague subjects: \"things\", \"it\", \"this\", \"people\", \"the economy\", \"the industry\" without naming who/what.",
  ].join("\n");
}
