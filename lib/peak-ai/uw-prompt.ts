export function looksLikeUnusualWhalesPrompt(text: string): boolean {
  return /\b(unusual\s*whales|peakflow|dark\s*pools?|congress(?:ional)?|senator|representative|market\s*tide|option(?:s)?\s+(?:flow|screener)|flow\s+alerts?|flow|screener|otm|prints?|whale|tide|tape)\b/i.test(
    text,
  );
}

export function peakAiToolStatusLabel(text: string): string {
  return looksLikeUnusualWhalesPrompt(text)
    ? "Checking Unusual Whales…"
    : "Asking Peak AI…";
}
