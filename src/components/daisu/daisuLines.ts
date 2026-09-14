// what daisu says, picked by situation. each mood has a few lines so she does not read
// like a status bar; the roll decides which, so a test can pin it
export type Mood =
  | "hello"
  | "full"
  | "filling"
  | "empty"
  | "failed"
  | "claimed"
  | "claimedCredit"
  | "pickChanged"
  | "credit"
  | "missionReady"
  | "missionDone"
  | "broke"
  | "poke0"
  | "poke1"
  | "poke2"
  | "gift"
  | "room"
  | "boostsEmpty";

export const LINE_COUNT: Record<Mood, number> = {
  hello: 3,
  full: 3,
  filling: 3,
  empty: 3,
  failed: 2,
  claimed: 3,
  claimedCredit: 3,
  pickChanged: 2,
  credit: 2,
  missionReady: 2,
  missionDone: 2,
  broke: 2,
  poke0: 4,
  poke1: 4,
  poke2: 4,
  gift: 2,
  room: 2,
  boostsEmpty: 1,
};

export const lineKey = (mood: Mood, roll: number) =>
  `daisu.lines.${mood}.${Math.min(LINE_COUNT[mood] - 1, Math.floor(roll * LINE_COUNT[mood]))}`;

interface Situation {
  fill: number;
  holdsCredit: boolean;
  missionReady: boolean;
  giftReady: boolean;
  wallet: number;
}

// the opening line: the most useful thing to say first, in the order a player would want
// to hear it. something to collect beats a full pot, which beats a credit going unused.
export const greetingFor = ({ fill, holdsCredit, missionReady, giftReady, wallet }: Situation): Mood => {
  if (giftReady) return "gift";
  if (missionReady) return "missionReady";
  if (fill >= 1) return "full";
  if (holdsCredit) return "credit";
  if (wallet < 50 && fill < 0.1) return "broke";
  if (fill >= 0.05) return "filling";
  return "hello";
};

// she gets less patient the more she is poked in a row
export const pokeMood = (pokes: number): Mood => (pokes <= 2 ? "poke0" : pokes <= 5 ? "poke1" : "poke2");
