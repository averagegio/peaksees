const UW_TOPIC =
  /\b(unusual\s*whales|peakflow|dark\s*pools?|congress(?:ional)?|senator|representative|market\s*tide|option(?:s)?\s+(?:flow|screener)|flow\s+alerts?|flow|screener|otm|prints?|whale|tide|tape)\b/i;

/** Strike shorthand like $140c, 250p, 12.5c */
const OPTION_SHORTHAND = /\b\$?\d+(?:\.\d+)?[cp]\b/i;

export function looksLikeUnusualWhalesPrompt(text: string): boolean {
  return UW_TOPIC.test(text) || OPTION_SHORTHAND.test(text);
}

export function peakAiToolStatusLabel(text: string): string {
  return looksLikeUnusualWhalesPrompt(text)
    ? "Checking Unusual Whales…"
    : "Asking Peak AI…";
}
