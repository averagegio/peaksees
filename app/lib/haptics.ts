/** Short vibration patterns for market-card gestures (mobile / supported devices). */
const PATTERNS: Record<string, number | number[]> = {
  press: 20,
  pull: [14, 36, 18],
  scrub: 12,
  reveal: [14, 36, 22],
  close: 8,
};

export type MarketCardHapticKind = keyof typeof PATTERNS;

let lastVibrateAt = 0;
let audioCtx: AudioContext | null = null;

function hapticClick(freq: number, durationSec = 0.014, gain = 0.07) {
  if (typeof window === "undefined") return;
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + durationSec);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec);
  } catch {
    // ignore
  }
}

/**
 * Fire device vibration when supported; uses a quiet tap tone as fallback (e.g. iOS).
 */
export function marketCardHaptic(
  kind: MarketCardHapticKind = "reveal",
): boolean {
  if (typeof navigator === "undefined") return false;

  const now = Date.now();
  if (kind === "scrub" && now - lastVibrateAt < 85) return false;

  let vibrated = false;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (vibrate) {
    try {
      vibrate(0);
      const ok = vibrate(PATTERNS[kind] ?? 10);
      vibrated = ok !== false;
    } catch {
      vibrated = false;
    }
  }

  if (!vibrated) {
    if (kind === "press") hapticClick(220);
    else if (kind === "pull") hapticClick(140, 0.018, 0.09);
    else if (kind === "scrub") hapticClick(180, 0.01, 0.05);
  }

  if (vibrated || kind !== "scrub") lastVibrateAt = now;
  return vibrated;
}
