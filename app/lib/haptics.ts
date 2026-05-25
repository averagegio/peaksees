/** Short vibration patterns for market-card gestures (mobile / supported devices). */
const PATTERNS: Record<string, number | number[]> = {
  press: 18,
  pull: [12, 32, 16],
  scrub: 11,
  reveal: [14, 36, 22],
  close: 8,
};

export type MarketCardHapticKind = keyof typeof PATTERNS;

let lastVibrateAt = 0;

/**
 * Fire device vibration when supported. Returns whether the browser accepted the request.
 * Clears the previous pattern first so rapid scrub ticks do not cancel the engage pulse.
 */
export function marketCardHaptic(
  kind: MarketCardHapticKind = "reveal",
): boolean {
  if (typeof navigator === "undefined") return false;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (!vibrate) return false;

  const now = Date.now();
  if (kind === "scrub" && now - lastVibrateAt < 90) return false;

  try {
    vibrate(0);
    const pattern = PATTERNS[kind];
    const ok = vibrate(pattern);
    if (ok !== false) lastVibrateAt = now;
    return ok !== false;
  } catch {
    return false;
  }
}
