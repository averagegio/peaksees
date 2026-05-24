/** Short vibration patterns for market-card gestures (mobile / supported devices). */
export function marketCardHaptic(
  kind: "press" | "pull" | "reveal" | "close" = "reveal",
) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  const patterns: Record<typeof kind, number | number[]> = {
    press: 5,
    pull: [3, 18, 10],
    reveal: [14, 36, 22],
    close: 6,
  };
  try {
    navigator.vibrate(patterns[kind]);
  } catch {
    // ignore
  }
}
