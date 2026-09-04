/** Client-safe helpers for the Peakflow / Peak Flow Peak AI composer. */

export const PEAK_AI_DESK_PLACEHOLDER =
  "Ask Peak about a ticker or option… e.g. NVDA flow, $140c";

export const PEAK_AI_DESK_EXAMPLES = ["NVDA flow", "$140c", "dark pool TSLA"] as const;

export const PEAK_AI_REPLY_PATHS = ["/peakflow", "/pricing"] as const;

export const PEAK_AI_REPLY_PATH_SPLIT = /(\/peakflow|\/pricing)/g;

export type PeakAiDeskTurn = {
  role: "user" | "peak";
  text: string;
};

export function buildPeakAiDeskChatRequest(text: string): {
  text: string;
  query: string;
  mode: "chat";
  source: "desk";
} {
  const t = text.trim().slice(0, 500);
  return { text: t, query: t, mode: "chat", source: "desk" };
}

export function appendDeskTurn(
  turns: PeakAiDeskTurn[],
  turn: PeakAiDeskTurn,
  max = 6,
): PeakAiDeskTurn[] {
  return [...turns, turn].slice(-Math.max(1, max));
}

export function peakAiDeskReplyNeedsPeakflowCta(
  reply: string,
  alreadyOnPeakflow: boolean,
): boolean {
  if (alreadyOnPeakflow) return false;
  return /\/peakflow|unusual whales|dark pool|congress|tide/i.test(reply);
}

export function splitPeakAiReplyParts(text: string): string[] {
  return text.split(PEAK_AI_REPLY_PATH_SPLIT);
}
