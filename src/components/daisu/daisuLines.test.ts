import { describe, it, expect } from "vitest";
import { greetingFor, helloKeys, lineKey, openingMood, pokeMood, relationshipRank } from "./daisuLines";
import en from "../../i18n/locales/en.json";
import pt from "../../i18n/locales/pt.json";
import ja from "../../i18n/locales/ja.json";

const situation = { fill: 0.5, holdsCredit: false, missionReady: false, giftReady: false, wallet: 500, bonusExpiring: false, bonusExpired: false };

type Locale = Record<string, unknown>;
const at = (locale: Locale, key: string) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], locale);

describe("which line she picks", () => {
  it("spreads a roll across every line of a mood and never runs off the end", () => {
    expect(lineKey("full", 0)).toBe("daisu.lines.full.0");
    expect(lineKey("full", 0.99)).toBe("daisu.lines.full.4");
    expect(lineKey("full", 1)).toBe("daisu.lines.full.4");
  });

  it("counts a mood's lines from the copy, so every line it can pick is written down in every language checked here", () => {
    const keys = [...helloKeys(5), ...["full", "filling", "claimed", "claimedCredit", "broke", "poke0", "poke2", "room", "bonusExpiring"].map((m) => lineKey(m as never, 0.999))];
    for (const locale of [en, pt, ja] as Locale[]) {
      for (const key of keys) expect(typeof at(locale, key)).toBe("string");
    }
  });
});

describe("relationship rank", () => {
  it("is how many chapters of her missions are finished, from 0 to 5", () => {
    expect(relationshipRank(null)).toBe(0);
    expect(relationshipRank({ chapter: 1, chapters: 5, finished: false })).toBe(0);
    expect(relationshipRank({ chapter: 3, chapters: 5, finished: false })).toBe(2);
    expect(relationshipRank({ chapter: 5, chapters: 5, finished: true })).toBe(5);
  });

  it("opens another tier of hello lines at each rank, keeping the ones before", () => {
    const base = helloKeys(0);
    expect(base.every((key) => key.startsWith("daisu.lines.hello."))).toBe(true);
    expect(helloKeys(1)).toEqual([...base, ...helloKeys(1).filter((k) => k.includes("helloRank1"))]);
    expect(helloKeys(2).some((key) => key.includes("helloRank2"))).toBe(true);
    expect(helloKeys(2).some((key) => key.includes("helloRank3"))).toBe(false);
    expect(helloKeys(9)).toEqual(helloKeys(5));
    expect(lineKey("hello", 0.9999, 0)).toBe(base[base.length - 1]);
    expect(lineKey("hello", 0.9999, 5)).toContain("helloRank5");
  });

  it("lets a sixth poke in a row reach the hello lines too", () => {
    expect(lineKey("poke2", 0.9999, 0)).toBe(helloKeys(0)[helloKeys(0).length - 1]);
    expect(lineKey("poke2", 0)).toBe("daisu.lines.poke2.0");
  });
});

describe("small talk on opening", () => {
  it("gives way to hello three times in four, but always warns about a bonus", () => {
    for (const mood of ["full", "broke", "credit", "missionReady", "gift"] as const) {
      expect(openingMood(mood, 0.74)).toBe("hello");
      expect(openingMood(mood, 0.75)).toBe(mood);
    }
    expect(openingMood("bonusExpiring", 0)).toBe("bonusExpiring");
    expect(openingMood("bonusExpired", 0)).toBe("bonusExpired");
  });
});

describe("what she opens with", () => {
  it("leads with a gift, then a reward to collect, over everything else", () => {
    expect(greetingFor({ ...situation, fill: 1, holdsCredit: true, missionReady: true, giftReady: true })).toBe("gift");
    expect(greetingFor({ ...situation, fill: 1, holdsCredit: true, missionReady: true })).toBe("missionReady");
  });

  it("warns about a bonus about to go before a full pot, and mourns one that just went", () => {
    expect(greetingFor({ ...situation, fill: 1, bonusExpiring: true, bonusExpired: true })).toBe("bonusExpiring");
    expect(greetingFor({ ...situation, fill: 1, bonusExpired: true })).toBe("bonusExpired");
    expect(greetingFor({ ...situation, giftReady: true, bonusExpiring: true })).toBe("gift");
  });

  it("then a full pot, then a credit going unused", () => {
    expect(greetingFor({ ...situation, fill: 1, holdsCredit: true })).toBe("full");
    expect(greetingFor({ ...situation, holdsCredit: true })).toBe("credit");
  });

  it("notices an empty wallet waiting on an empty pot", () => {
    expect(greetingFor({ ...situation, fill: 0.02, wallet: 10 })).toBe("broke");
  });

  it("just says hello over a pot still filling, since the filling lines wait for a take to settle", () => {
    expect(greetingFor(situation)).toBe("hello");
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
