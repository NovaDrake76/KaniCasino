import type { SoundEvent } from "./events";

// a split settles several hands at once; the sound is for the best of them
interface SettledLike {
  hands?: { outcome?: string | null }[];
}

export const outcomeSound = (settled: SettledLike): SoundEvent => {
  const outcomes = (settled.hands || []).map((h) => String(h.outcome || ""));
  if (outcomes.includes("blackjack")) return "bj.blackjack";
  if (outcomes.some((o) => o === "win")) return "game.win";
  if (outcomes.some((o) => o === "push")) return "bj.push";
  return "game.lose";
};
