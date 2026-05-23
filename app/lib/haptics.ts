/** Short vibration patterns for market-card gestures (mobile / supported devices). */
export function marketCardHaptic(kind: "press" | "reveal" | "close" = "reveal") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  const patterns: Record<typeof kind, number | number[]> = {
    press: 8,
    reveal: [10, 28, 16],
    close: 6,
  };
  try {
    navigator.vibrate(patterns[kind]);
  } catch {
    // ignore
  }
}
