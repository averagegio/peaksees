/** Short vibration patterns for market-card gestures (mobile / supported devices). */
export function marketCardHaptic(
  kind: "press" | "pull" | "scrub" | "reveal" | "close" = "reveal",
) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  const patterns: Record<typeof kind, number | number[]> = {
    press: 14,
    pull: [10, 28, 14],
    scrub: 9,
    reveal: [14, 36, 22],
    close: 6,
  };
  try {
    navigator.vibrate(patterns[kind]);
  } catch {
    // ignore
  }
}
