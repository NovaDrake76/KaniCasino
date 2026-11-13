import i18n from "../../i18n";

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
  | "credit"
  | "bonusExpiring"
  | "bonusExpired"
  | "missionReady"
  | "missionDone"
  | "broke"
  | "poke0"
  | "poke1"
  | "poke2"
  | "gift"
  | "room"
  | "stillThere"
  | "stillThereThanks";

// the highest relationship rank, one per chapter of her missions
export const RANKS = 5;

// relationship rank is never shown: it is how many chapters of her missions the player has finished, and each one opens another tier of hello lines
export const relationshipRank = (roadmap: { chapter: number; chapters: number; finished: boolean } | null | undefined) =>
  roadmap ? Math.max(0, Math.min(RANKS, roadmap.finished ? roadmap.chapters : roadmap.chapter - 1)) : 0;

// a group's lines are counted off the copy itself, so adding a line to the locales is all it takes
const keysOf = (group: string) => {
  const lines = i18n.t(`daisu.lines.${group}`, { returnObjects: true });
  const count = lines && typeof lines === "object" ? Object.keys(lines).length : 0;
  return Array.from({ length: count }, (_, i) => `daisu.lines.${group}.${i}`);
};

// the hello lines a rank can reach: the base set plus every tier up to it
export const helloKeys = (rank: number) => [
  ...keysOf("hello"),
  ...Array.from({ length: Math.max(0, Math.min(RANKS, rank)) }, (_, i) => keysOf(`helloRank${i + 1}`)).flat(),
];

// poked six times or more in a row, she may say anything from hello as well. a line in `recent` waits its turn;
// when a small group has said them all, the one said longest ago comes back first
export const lineKey = (mood: Mood, roll: number, rank = 0, recent: string[] = []) => {
  const keys = mood === "hello" ? helloKeys(rank) : mood === "poke2" ? [...keysOf("poke2"), ...helloKeys(rank)] : keysOf(mood);
  const fresh = keys.filter((key) => !recent.includes(key));
  if (!fresh.length) return [...keys].sort((a, b) => recent.lastIndexOf(a) - recent.lastIndexOf(b))[0];
  return fresh[Math.min(fresh.length - 1, Math.floor(roll * fresh.length))];
};

// what she said lately in this tab, so a click streak does not hear the same line again and again
const RECENT_LINES = 8;
const said: string[] = [];

export const pickLine = (mood: Mood, roll: number, rank = 0) => {
  const key = lineKey(mood, roll, rank, said);
  said.push(key);
  if (said.length > RECENT_LINES) said.shift();
  return key;
};

interface Situation {
  fill: number;
  holdsCredit: boolean;
  missionReady: boolean;
  giftReady: boolean;
  wallet: number;
  bonusExpiring: boolean;
  bonusExpired: boolean;
}

// the opening line: the most useful thing to say first. something to collect, then a bonus
// about to go or just gone, then a full pot, then a credit going unused.
export const greetingFor = ({ fill, holdsCredit, missionReady, giftReady, wallet, bonusExpiring, bonusExpired }: Situation): Mood => {
  if (giftReady) return "gift";
  if (missionReady) return "missionReady";
  if (bonusExpiring) return "bonusExpiring";
  if (bonusExpired) return "bonusExpired";
  if (fill >= 1) return "full";
  if (holdsCredit) return "credit";
  if (wallet < 50 && fill < 0.1) return "broke";
  return "hello";
};

// three openings in four give way to small talk, so the big hello set keeps turning up; a bonus about to go or just gone is always said
const SMALL_TALK_ODDS = 0.75;
const URGENT: Mood[] = ["bonusExpiring", "bonusExpired"];
export const openingMood = (mood: Mood, roll: number): Mood => (URGENT.includes(mood) || roll >= SMALL_TALK_ODDS ? mood : "hello");

// she gets less patient the more she is poked in a row
export const pokeMood = (pokes: number): Mood => (pokes <= 2 ? "poke0" : pokes <= 5 ? "poke1" : "poke2");
