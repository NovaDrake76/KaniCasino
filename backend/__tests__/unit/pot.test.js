const pot = require("../../utils/pot");

const minutes = (n) => n * 60000;
const cycleStartedAgo = (ms, now) => new Date(now.getTime() - ms + pot.CYCLE_MS);

describe("how full the pot is", () => {
  const now = new Date("2026-09-10T12:00:00Z");

  it("is empty the moment it was claimed and full eight minutes later", () => {
    expect(pot.fillAt(cycleStartedAgo(0, now), now)).toBe(0);
    expect(pot.fillAt(cycleStartedAgo(minutes(4), now), now)).toBeCloseTo(0.5);
    expect(pot.fillAt(cycleStartedAgo(minutes(8), now), now)).toBe(1);
  });

  it("stays full however long it waits, like the button did", () => {
    expect(pot.fillAt(cycleStartedAgo(minutes(600), now), now)).toBe(1);
  });

  it("is full for a brand new account, whose cycle is dated a day back", () => {
    expect(pot.fillAt(new Date(now.getTime() - 86400000), now)).toBe(1);
  });
});

describe("what a claim pays", () => {
  it("pays the whole pot when full", () => {
    expect(pot.payout(500, 1)).toBe(500);
  });

  it("pays less than the proportional share before that, so waiting is worth a little", () => {
    expect(pot.payout(500, 0.5)).toBeLessThan(250);
    expect(pot.payout(500, 0.5)).toBeGreaterThan(200);
  });

  it("never pays more per minute than a full pot does, at any fill", () => {
    const fullRate = pot.payout(1000, 1) / pot.CYCLE_MS;
    for (let f = pot.FLOOR; f <= 1; f += 0.01) {
      const rate = pot.payout(1000, f) / (f * pot.CYCLE_MS);
      expect(rate).toBeLessThanOrEqual(fullRate + 1e-9);
    }
  });

  it("grows with the fill, so nobody is paid less for waiting", () => {
    let last = -1;
    for (let f = 0; f <= 1; f += 0.005) {
      const now = pot.payout(700, f);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
  });

  it("sizes the pot the way the button did at every level", () => {
    expect(pot.fullAmount(0)).toBe(200);
    expect(pot.fullAmount(9)).toBe(380);
    expect(pot.fullAmount(25)).toBe(700);
  });

  it("adds a tenth on top as credit", () => {
    expect(pot.creditOf(500)).toBe(50);
    expect(pot.creditOf(7)).toBe(0);
  });
});

describe("the pick of the day", () => {
  it("walks the list one game a day and comes back around", () => {
    const seen = new Set();
    for (let d = 0; d < pot.PICKS.length; d++) seen.add(pot.pickFor(20000 + d));
    expect(seen.size).toBe(pot.PICKS.length);
    expect(pot.pickFor(20000)).toBe(pot.pickFor(20000 + pot.PICKS.length));
  });

  it("only ever picks a game a bet type maps to", () => {
    const backed = new Set(Object.values(pot.GAME_OF_BET));
    for (const game of pot.PICKS) expect(backed.has(game)).toBe(true);
  });
});

describe("reading credits off a user", () => {
  it("reads a plain object, a map, and nothing at all", () => {
    expect(pot.creditHeld({ gameCredits: { dice: 40 } }, "dice")).toBe(40);
    expect(pot.creditHeld({ gameCredits: new Map([["dice", 40]]) }, "dice")).toBe(40);
    expect(pot.creditHeld({}, "dice")).toBe(0);
    expect(pot.creditHeld({ gameCredits: { dice: 40 } }, "slots")).toBe(0);
  });

  it("lists only the games with something left", () => {
    expect(pot.creditsOf({ gameCredits: { dice: 40, slots: 0 } })).toEqual({ dice: 40 });
    expect(pot.creditsOf({})).toEqual({});
  });
});
