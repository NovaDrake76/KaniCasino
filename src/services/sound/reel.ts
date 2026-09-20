import { play } from "./sound";
import type { SoundEvent } from "./events";

// ticks for an ease-out reel: slot k passes at duration * (1 - cbrt(1 - k/slots)), close enough to the roulette's curve; returns a canceller
export const scheduleReelTicks = (durationMs: number, slots: number, event: SoundEvent = "case.tick") => {
  const timers: number[] = [];
  for (let k = 1; k <= slots; k++) {
    const t = durationMs * (1 - Math.cbrt(1 - k / slots));
    // pitch drifts down as the reel slows, with a little wander so no two ticks are identical
    const rate = (1.08 - 0.16 * (k / slots)) * (0.97 + Math.random() * 0.06);
    timers.push(window.setTimeout(() => play(event, { rate: [rate, rate], throttleMs: 0 }), t));
  }
  return () => timers.forEach((id) => window.clearTimeout(id));
};

// rarity ids run 1 (common) to 5 (legendary); a multi-open plays its best pull
export const revealSoundFor = (rarities: number[]): SoundEvent => {
  const best = Math.max(0, ...rarities.filter((r) => Number.isFinite(r)));
  if (best >= 5) return "case.reveal.legendary";
  if (best >= 4) return "case.reveal.epic";
  if (best >= 3) return "case.reveal.rare";
  return "case.reveal.common";
};
