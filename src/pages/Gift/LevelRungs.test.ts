import { describe, it, expect } from "vitest";
import { visibleRungs } from "./LevelRungs";
import type { TopSlotRung } from "./Gift.types";

// the real wheel, with 1x included the way the server sends it
const wheel = (level: number): TopSlotRung[] =>
  [
    { multiplier: 1, minLevel: 0 },
    { multiplier: 2, minLevel: 0 },
    { multiplier: 3, minLevel: 10 },
    { multiplier: 5, minLevel: 30 },
    { multiplier: 10, minLevel: 60 },
    { multiplier: 25, minLevel: 100 },
  ].map((r) => ({ ...r, locked: level < r.minLevel, chance: 5 }));

const shown = (level: number) => visibleRungs(wheel(level)).rows.map((r) => r.multiplier);

describe("which level rungs are worth a row", () => {
  it("never lists 1x, which is not a prize", () => {
    expect(shown(55)).not.toContain(1);
  });

  it("keeps the card to three rows at any level", () => {
    for (const level of [0, 5, 10, 29, 30, 60, 99, 100, 140]) {
      expect(shown(level).length).toBeLessThanOrEqual(3);
    }
  });

  it("shows the best rung held, not every one already earned", () => {
    // at 55 the player holds 2x, 3x and 5x; only 5x is worth a row
    expect(shown(55)).toEqual([5, 10, 25]);
  });

  it("always keeps the top rung, because the moonshot is why the list is public", () => {
    for (const level of [0, 15, 40, 75]) {
      expect(shown(level)).toContain(25);
    }
  });

  it("marks the jump when it skips a rung to reach the top", () => {
    // a new player sees 2x, the next one at 3x, then straight to 25x
    const { rows, gapBefore } = visibleRungs(wheel(0));
    expect(rows.map((r) => r.multiplier)).toEqual([2, 3, 25]);
    expect(gapBefore).toBe(25);
  });

  it("marks no jump when the rows already run consecutively", () => {
    expect(visibleRungs(wheel(55)).gapBefore).toBe(null);
  });

  it("shows only what is held once everything is unlocked", () => {
    expect(shown(140)).toEqual([25]);
  });

  it("copes with a player who holds nothing above 1x", () => {
    const none = wheel(0).map((r) => ({ ...r, locked: r.multiplier > 1 }));
    expect(visibleRungs(none).rows.map((r) => r.multiplier)).toEqual([2, 3, 25]);
  });
});
