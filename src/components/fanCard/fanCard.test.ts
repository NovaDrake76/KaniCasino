import { describe, it, expect } from "vitest";
import { ALL_STYLES, PINNED, resolveStyle, stylesFor } from "./cardStyles";
import { canShareCard, cardFromBoard, cardFromStanding, yearOf } from "./cardData";
import { fileNameFor } from "./ShareCard/ShareCard.services";
import { FanBoard, FanRank } from "../../services/fandom/FandomService";

const fan = {
  userId: "u1",
  username: "Konmaru",
  profilePicture: "p.png",
  level: 48,
  count: 490,
  since: "2026-08-22T12:57:08.524Z",
};

const board: FanBoard = {
  name: "Keine",
  image: "keine.png",
  rarity: "1",
  caseId: "c1",
  fanCount: 5,
  topCount: 490,
  secondCount: 4,
  gap: 486,
  top: fan,
  ranks: [fan],
  updatedAt: "2026-08-22T12:57:08.524Z",
};

describe("which styles are offered", () => {
  it("opens the posters only to a board leader", () => {
    expect(stylesFor(true)).toEqual(ALL_STYLES);
    expect(stylesFor(false)).toEqual([PINNED]);
  });

  it("reads a style the player cannot use as the default", () => {
    expect(resolveStyle("agit", stylesFor(true))).toBe("agit");
    expect(resolveStyle("agit", stylesFor(false))).toBe(PINNED);
    expect(resolveStyle(null, stylesFor(true))).toBe(PINNED);
    expect(resolveStyle("nonsense", stylesFor(true))).toBe(PINNED);
  });
});

describe("building the card", () => {
  it("takes every number off the board, runner-up included", () => {
    const card = cardFromBoard(board, "she taught me everything");
    expect(card).toEqual({
      name: "Keine",
      image: "keine.png",
      rarity: "1",
      holder: "Konmaru",
      level: 48,
      count: 490,
      second: 4,
      fans: 5,
      since: 2026,
      desc: "she taught me everything",
    });
  });

  it("has no card for a board nobody leads", () => {
    expect(cardFromBoard({ ...board, top: null }, "")).toBeNull();
  });

  it("builds the same card from the standing left on the player", () => {
    const fanRank: FanRank = {
      name: "Keine",
      image: "keine.png",
      rarity: "1",
      count: 490,
      rank: 1,
      fans: 5,
      second: 4,
      since: "2026-08-22T12:57:08.524Z",
    };
    expect(cardFromStanding(fanRank, "Konmaru", 48, "hi")).toEqual(cardFromBoard(board, "hi"));
  });

  it("treats a standing written before the sweep carried a runner-up as a clear lead", () => {
    const old = { name: "Keine", image: "k.png", rarity: "1", count: 12, rank: 1, fans: 2 };
    expect(cardFromStanding(old, "Konmaru", 48)?.second).toBe(0);
  });

  it("has no card for a player who pinned nothing", () => {
    expect(cardFromStanding(null, "Konmaru", 48)).toBeNull();
  });

  it("only lets the board leader share", () => {
    const lead = { name: "Keine", image: "k.png", rarity: "1", count: 490, rank: 1, fans: 5 };
    expect(canShareCard(lead)).toBe(true);
    expect(canShareCard({ ...lead, rank: 2, count: 4 })).toBe(false);
    expect(canShareCard(null)).toBe(false);
    expect(canShareCard(undefined)).toBe(false);
  });
});

describe("supporting bits", () => {
  it("falls back to this year when the pin date is missing or unreadable", () => {
    const now = new Date().getFullYear();
    expect(yearOf("2024-06-08T17:27:43.000Z")).toBe(2024);
    expect(yearOf(null)).toBe(now);
    expect(yearOf("not a date")).toBe(now);
  });

  it("names the download after the character, not after the style", () => {
    expect(fileNameFor("Keine")).toBe("keine-top-fan.png");
    expect(fileNameFor("Yuuma Toutetsu")).toBe("yuuma-toutetsu-top-fan.png");
    expect(fileNameFor("???")).toBe("fan-top-fan.png");
  });
});
