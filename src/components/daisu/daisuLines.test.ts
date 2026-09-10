import { describe, it, expect } from "vitest";
import { LINE_COUNT, greetingFor, lineKey, pokeMood } from "./daisuLines";
import { groupMissions } from "./Daisu.services";
import en from "../../i18n/locales/en.json";
import pt from "../../i18n/locales/pt.json";
import ja from "../../i18n/locales/ja.json";
import type { Mission } from "../../services/missions/MissionService";

const situation = { fill: 0.5, holdsCredit: false, missionReady: false, giftReady: false, wallet: 500 };

type Locale = { daisu: { lines: Record<string, Record<string, string>> } };

describe("which line she picks", () => {
  it("spreads a roll across every line of a mood and never runs off the end", () => {
    expect(lineKey("full", 0)).toBe("daisu.lines.full.0");
    expect(lineKey("full", 0.99)).toBe("daisu.lines.full.2");
    expect(lineKey("full", 1)).toBe("daisu.lines.full.2");
  });

  it("has every line it can pick written down, in every language checked here", () => {
    for (const locale of [en, pt, ja] as Locale[]) {
      for (const [mood, count] of Object.entries(LINE_COUNT)) {
        for (let i = 0; i < count; i++) expect(typeof locale.daisu.lines[mood][String(i)]).toBe("string");
      }
    }
  });
});

describe("what she opens with", () => {
  it("leads with a gift, then a reward to collect, over everything else", () => {
    expect(greetingFor({ ...situation, fill: 1, holdsCredit: true, missionReady: true, giftReady: true })).toBe("gift");
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

describe("being poked", () => {
  it("gets less patient the more it happens in a row", () => {
    expect(pokeMood(1)).toBe("poke0");
    expect(pokeMood(2)).toBe("poke0");
    expect(pokeMood(3)).toBe("poke1");
    expect(pokeMood(5)).toBe("poke1");
    expect(pokeMood(6)).toBe("poke2");
    expect(pokeMood(40)).toBe("poke2");
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

describe("her room's mission list", () => {
  it("groups by category in the order the missions tab uses and drops empty groups", () => {
    const groups = groupMissions([
      mission({ key: "a", category: "endgame" }),
      mission({ key: "b", category: "onboarding" }),
      mission({ key: "c", category: "games" }),
    ]);

    expect(groups.map((g) => g.key)).toEqual(["onboarding", "games", "endgame"]);
    expect(groups[0].missions[0].key).toBe("b");
  });
});
