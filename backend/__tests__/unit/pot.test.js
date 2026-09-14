const pot = require("../../utils/pot");

const minutes = (n) => n * 60000;
const cycleStartedAgo = (ms, now) => new Date(now.getTime() - ms + pot.CYCLE_MS);

describe("how full the pot is", () => {
  const now = new Date("2026-09-10T12:00:00Z");

  it("is empty the moment it was taken and full eight minutes later", () => {
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

describe("what a take pays", () => {
  it("pays the whole pot when full", () => {
    expect(pot.payout(500, 1)).toBe(500);
  });

  it("pays the click rate of the full rate on an early take", () => {
    expect(pot.payout(1000, 0.5)).toBe(450);
    expect(pot.payout(1000, 0.01)).toBe(8);
  });

  it("never pays more per minute than a full pot does, at any fill", () => {
    const fullRate = pot.payout(1000, 1) / pot.CYCLE_MS;
    for (let f = 0.001; f <= 1; f += 0.001) {
      const rate = pot.payout(1000, f) / (f * pot.CYCLE_MS);
      expect(rate).toBeLessThanOrEqual(fullRate + 1e-9);
    }
  });

  it("makes clicking through a whole cycle pay less than waiting for it", () => {
    let clicked = 0;
    for (let i = 0; i < 240; i++) clicked += pot.payout(1000, 1 / 240);
    expect(clicked).toBeLessThan(pot.payout(1000, 1) * pot.CLICK_RATE + 1);
    // each click floors to a whole coin, so the run can trail the click rate by up to one per click
    expect(clicked).toBeGreaterThan(pot.payout(1000, 1) * pot.CLICK_RATE - 240);
  });

  it("grows with the fill, so nobody is paid less for waiting", () => {
    let last = -1;
    for (let f = 0; f <= 1; f += 0.005) {
      const now = pot.payout(700, f);
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
  });

  it("calls the gap between clicking and waiting the full bonus", () => {
    expect(pot.FULL_BONUS).toBeCloseTo(0.25);
  });

  it("sizes the pot the way the button did at every level", () => {
    expect(pot.fullAmount(0)).toBe(200);
    expect(pot.fullAmount(9)).toBe(380);
    expect(pot.fullAmount(25)).toBe(700);
  });

  it("adds a tenth on top as credit, to the cent", () => {
    expect(pot.creditOf(500)).toBe(50);
    expect(pot.creditOf(7)).toBe(0.7);
  });

  it("says when a click would first find a coin", () => {
    const now = new Date("2026-09-10T12:00:00Z");
    const ready = pot.readyAt(cycleStartedAgo(0, now), 200);
    expect(ready.getTime()).toBeGreaterThan(now.getTime());
    expect(pot.payout(200, pot.fillAt(cycleStartedAgo(0, now), ready))).toBeGreaterThanOrEqual(1);
    expect(ready.getTime() - now.getTime()).toBeLessThan(minutes(1));
  });
});

describe("the pick", () => {
  it("walks the list and comes back around", () => {
    const seen = new Set();
    for (let i = 0; i < pot.PICKS.length; i++) seen.add(pot.pickAt(i));
    expect(seen.size).toBe(pot.PICKS.length);
    expect(pot.pickAt(0)).toBe(pot.pickAt(pot.PICKS.length));
    expect(pot.pickAt(undefined)).toBe(pot.PICKS[0]);
  });

  it("moves on once a whole pot has been taken, however it was taken", () => {
    let state = { index: 0, cycleClaimed: 0 };
    for (let i = 0; i < 9; i++) state = pot.advancePick(state.index, state.cycleClaimed, 100, 500);
    expect(state.index).toBe(1);
    expect(state.cycleClaimed).toBe(400);
  });

  it("can move on more than once from a single big take", () => {
    expect(pot.advancePick(2, 450, 1100, 500)).toEqual({ index: 5, cycleClaimed: 50 });
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

  it("only lets a bet spend credit still on the clock, and treats credit with no clock as expired", () => {
    const soon = new Date(Date.now() + 60000);
    const gone = new Date(Date.now() - 60000);
    expect(pot.creditLive({ gameCredits: { dice: 40 }, gameCreditsExpireAt: { dice: soon } }, "dice")).toBe(40);
    expect(pot.creditLive({ gameCredits: { dice: 40 }, gameCreditsExpireAt: { dice: gone } }, "dice")).toBe(0);
    expect(pot.creditLive({ gameCredits: { dice: 40 } }, "dice")).toBe(0);
  });

  it("lists live bonuses freshest first, then the expired ones still waiting to be burned", () => {
    const user = {
      gameCredits: { slots: 10, dice: 20, mines: 30, hilo: 0 },
      gameCreditsExpireAt: {
        slots: new Date(Date.now() + 60000),
        dice: new Date(Date.now() + 300000),
        mines: new Date(Date.now() - 1000),
      },
    };

    expect(pot.bonusesOf(user).map((b) => [b.game, b.amount, b.expired])).toEqual([
      ["dice", 20, false],
      ["slots", 10, false],
      ["mines", 30, true],
    ]);
    expect(pot.expiredCredits(user).map((b) => b.game)).toEqual(["mines"]);
    expect(pot.bonusesOf({})).toEqual([]);
  });
});
