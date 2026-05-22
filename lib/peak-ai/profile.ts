export const PEAK_AI_HANDLE = "peak";

export const PEAK_AI_PROFILE = {
  displayName: "Peak AI",
  handle: `@${PEAK_AI_HANDLE}`,
  avatarHue: 160,
  bio:
    "Peak AI scans live news and culture signals, then publishes forward-looking prediction markets for the peaksees feed. " +
    "Markets settle on real outcomes — trade Yes/No, bookmark ideas, and tap the peak badge after you bet to see how Peak disagrees with the crowd.",
} as const;

export function isPeakAiHandle(slug: string): boolean {
  return slug.trim().toLowerCase().replace(/^@/, "") === PEAK_AI_HANDLE;
}
