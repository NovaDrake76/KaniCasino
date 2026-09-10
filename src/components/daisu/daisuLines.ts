// what daisu says, picked by situation. each mood has a few lines so she does not read
// like a status bar; the roll decides which, so a test can pin it
export type Mood =
  | "hello"
  | "full"
  | "filling"
  | "empty"
  | "claimed"
  | "claimedCredit"
  | "credit"
  | "missionReady"
  | "missionDone"
  | "broke";

export const LINE_COUNT: Record<Mood, number> = {
  hello: 3,
  full: 3,
  filling: 3,
  empty: 3,
  claimed: 3,
  claimedCredit: 3,
  credit: 2,
  missionReady: 2,
  missionDone: 2,
  broke: 2,
};

export const lineKey = (mood: Mood, roll: number) =>
  `daisu.lines.${mood}.${Math.min(LINE_COUNT[mood] - 1, Math.floor(roll * LINE_COUNT[mood]))}`;

interface Situation {
  fill: number;
  floor: number;
  holdsCredit: boolean;
  missionReady: boolean;
  wallet: number;
}

// the opening line: the most useful thing to say first, in the order a player would want
// to hear it. a reward to collect beats a full pot, which beats a credit going unused.
export const greetingFor = ({ fill, floor, holdsCredit, missionReady, wallet }: Situation): Mood => {
  if (missionReady) return "missionReady";
  if (fill >= 1) return "full";
  if (holdsCredit) return "credit";
  if (wallet < 50 && fill < floor) return "broke";
  if (fill >= floor) return "filling";
  return "hello";
};
