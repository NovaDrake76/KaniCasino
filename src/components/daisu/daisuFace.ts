export type Expression = "default" | "smug" | "sharp";
type Eyes = "default" | "smug" | "sharp";
type Mouth = "closed" | "open" | "smug";

// one drawing set per expression: the eyes she wears, the mouth she rests on, and the
// mouths a line flaps through while she says it. the closed mouth is drawn turned down, so
// under smug's lowered lids it read as a pout; smug keeps its own mouth at rest
export const EXPRESSIONS: Record<Expression, { eyes: Eyes; rest: Mouth; talk: Mouth[] }> = {
  default: { eyes: "default", rest: "closed", talk: ["open"] },
  smug: { eyes: "smug", rest: "smug", talk: ["open"] },
  sharp: { eyes: "sharp", rest: "closed", talk: ["open"] },
};

// the face a group of lines wears unless one of its lines says otherwise
export const BY_GROUP: Record<string, Expression> = {
  hello: "default",
  helloRank1: "smug",
  helloRank2: "default",
  helloRank3: "smug",
  helloRank4: "default",
  helloRank5: "default",
  full: "smug",
  filling: "default",
  empty: "sharp",
  failed: "sharp",
  bonusExpiring: "sharp",
  bonusExpired: "smug",
  claimed: "default",
  claimedCredit: "default",
  credit: "smug",
  missionReady: "smug",
  missionDone: "smug",
  broke: "smug",
  poke0: "sharp",
  poke1: "sharp",
  poke2: "smug",
  gift: "smug",
  room: "default",
};

// the lines that want a face of their own: a tease, or something she is sharp about
export const BY_LINE: Record<string, Expression> = {
  "hello.0": "smug", "hello.1": "smug", "hello.2": "smug", "hello.3": "smug", "hello.4": "smug",
  "hello.7": "smug", "hello.8": "smug", "hello.10": "smug", "hello.12": "smug", "hello.13": "smug",
  "hello.17": "smug", "hello.21": "smug", "hello.25": "smug", "hello.28": "smug", "hello.35": "smug",
  "hello.11": "sharp", "hello.15": "sharp", "hello.16": "sharp", "hello.22": "sharp", "hello.23": "sharp",
  "hello.24": "sharp", "hello.26": "sharp", "hello.29": "sharp", "hello.32": "sharp", "hello.34": "sharp",
  "hello.36": "sharp",
  "helloRank1.2": "default", "helloRank1.4": "default", "helloRank1.3": "sharp",
  "helloRank2.0": "smug", "helloRank2.1": "smug", "helloRank2.2": "smug", "helloRank2.4": "sharp",
  "helloRank3.0": "default", "helloRank3.3": "default", "helloRank3.5": "default", "helloRank3.7": "default",
  "helloRank3.6": "sharp", "helloRank3.8": "sharp", "helloRank3.9": "sharp",
  "helloRank4.1": "smug", "helloRank4.3": "smug", "helloRank4.7": "smug", "helloRank4.6": "sharp",
  "helloRank5.2": "smug", "helloRank5.6": "smug", "helloRank5.7": "smug", "helloRank5.8": "smug",
  "helloRank5.11": "smug", "helloRank5.12": "smug", "helloRank5.13": "smug", "helloRank5.19": "smug",
  "helloRank5.1": "sharp", "helloRank5.3": "sharp", "helloRank5.10": "sharp", "helloRank5.15": "sharp",
  "helloRank5.16": "sharp", "helloRank5.18": "sharp",
  "full.2": "default", "full.3": "default", "full.4": "default",
  "filling.4": "sharp",
  "empty.1": "smug",
  "failed.1": "default",
  "bonusExpiring.1": "default",
  "claimedCredit.1": "sharp",
  "broke.1": "sharp",
  "poke0.2": "smug", "poke0.4": "default",
  "poke1.1": "smug", "poke1.3": "smug",
  "room.2": "smug",
};

// a line key is daisu.lines.<group>.<index>, so the face is the line's own or its group's
export const expressionFor = (key: string | null | undefined): Expression => {
  if (!key) return "default";
  const [, , group, index] = key.split(".");
  return BY_LINE[`${group}.${index}`] || BY_GROUP[group] || "default";
};

// the five drawings of the jar, a quarter of the cycle each, so the full one is reached
// only when the pot really is full
export const jarStage = (fill: number): number => {
  if (!(fill > 0)) return 0;
  return Math.min(4, Math.floor(fill * 4));
};
