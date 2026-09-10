import { describe, it, expect } from "vitest";
import { LINE_COUNT, greetingFor, lineKey } from "./daisuLines";
import { pickAsks } from "./Daisu.services";
import en from "../../i18n/locales/en.json";
import type { Mission } from "../../services/missions/MissionService";

const situation = { fill: 0.5, floor: 0.1, holdsCredit: false, missionReady: false, wallet: 500 };

describe("which line she picks", () => {
  it("spreads a roll across every line of a mood and never runs off the end", () => {
    expect(lineKey("full", 0)).toBe("daisu.lines.full.0");
    expect(lineKey("full", 0.99)).toBe("daisu.lines.full.2");
    expect(lineKey("full", 1)).toBe("daisu.lines.full.2");
  });

  it("has every line it can pick written down, in english at least", () => {
    const lines = (en as { daisu: { lines: Record<string, Record<string, string>> } }).daisu.lines;
    for (const [mood, count] of Object.entries(LINE_COUNT)) {
      for (let i = 0; i < count; i++) expect(typeof lines[mood][String(i)]).toBe("string");
    }
  });
});

describe("what she opens with", () => {
  it("leads with a reward to collect over everything else", () => {
    expect(greetingFor({ ...situation, fill: 1, holdsCredit: true, missionReady: true })).toBe("missionReady");
  });

  it("then a full pot, then a credit going unused", () => {
    expect(greetingFor({ ...situation, fill: 1, holdsCredit: true })).toBe("full");
    expect(greetingFor({ ...situation, holdsCredit: true })).toBe("credit");
  });

  it("notices an empty wallet waiting on an empty pot", () => {
    expect(greetingFor({ ...situation, fill: 0.02, wallet: 10 })).toBe("broke");
  });

  it("talks about the pot when there is something in it, and just says hello when not", () => {
    expect(greetingFor(situation)).toBe("filling");
    expect(greetingFor({ ...situation, fill: 0.02 })).toBe("hello");
  });
});

const mission = (over: Partial<Mission>): Mission => ({
  key: "k",
  title: "t",
  description: "",
  category: "games",
  reward: 100,
  social: null,
  target: 10,
  current: 0,
  complete: false,
  claimed: false,
  claimable: false,
  ...over,
});

describe("what she asks for", () => {
  it("puts a reward to collect first, then whatever is closest, and drops the claimed", () => {
    const asks = pickAsks([
      mission({ key: "far", current: 1 }),
      mission({ key: "done", claimed: true, current: 10 }),
      mission({ key: "near", current: 8 }),
      mission({ key: "ready", claimable: true, current: 10 }),
      mission({ key: "mid", current: 5 }),
    ]);

    expect(asks.map((m) => m.key)).toEqual(["ready", "near", "mid"]);
  });
});
