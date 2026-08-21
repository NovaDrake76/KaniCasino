const { refundUncalled, buildPots, splitPot, potTotal } = require("../../utils/pokerPots");
const { rakeFor, applyRake, RAKE_CAP_BB } = require("../../utils/pokerRake");
const { SEAT } = require("../../utils/pokerBetting");

const seat = (totalCommitted, status = SEAT.ACTIVE) => ({ totalCommitted, status });

describe("uncalled bets", () => {
  it("hands back what nobody could match", () => {
    const seats = [seat(500), seat(200, SEAT.ALLIN)];
    expect(refundUncalled(seats)).toEqual({ seat: 0, amount: 300, cappedAt: 200 });
  });

  it("returns nothing when the top two are level", () => {
    expect(refundUncalled([seat(200), seat(200)])).toBeNull();
  });

  // a folded player's chips are still in the pot, so they cap the refund like any other
  it("counts a folded player's chips as called", () => {
    const seats = [seat(500), seat(100, SEAT.FOLDED)];
    expect(refundUncalled(seats)).toEqual({ seat: 0, amount: 400, cappedAt: 100 });
  });

  it("returns nothing when nobody bet", () => {
    expect(refundUncalled([seat(0), seat(0)])).toBeNull();
  });
});

describe("side pots", () => {
  it("makes one pot when everybody is in for the same", () => {
    const pots = buildPots([seat(100), seat(100), seat(100)]);
    expect(pots).toHaveLength(1);
    expect(pots[0]).toEqual({ amount: 300, eligible: [0, 1, 2] });
  });

  it("splits at each all-in level", () => {
    const pots = buildPots([seat(50, SEAT.ALLIN), seat(200), seat(200)]);
    expect(pots).toHaveLength(2);
    expect(pots[0]).toEqual({ amount: 150, eligible: [0, 1, 2] });
    expect(pots[1]).toEqual({ amount: 300, eligible: [1, 2] });
    expect(potTotal(pots)).toBe(450);
  });

  it("handles three all-in levels", () => {
    const pots = buildPots([seat(50, SEAT.ALLIN), seat(120, SEAT.ALLIN), seat(300)]);
    expect(pots.map((p) => p.amount)).toEqual([150, 140, 180]);
    expect(pots.map((p) => p.eligible)).toEqual([[0, 1, 2], [1, 2], [2]]);
  });

  it("keeps a folded player's chips in the pot but not their eligibility", () => {
    const pots = buildPots([seat(100, SEAT.FOLDED), seat(100), seat(100)]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligible).toEqual([1, 2]);
  });

  it("merges layers nobody new became eligible for", () => {
    const pots = buildPots([seat(100, SEAT.FOLDED), seat(200), seat(200)]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(500);
  });

  it("conserves every chip committed", () => {
    const seats = [seat(37, SEAT.ALLIN), seat(199, SEAT.ALLIN), seat(400), seat(12, SEAT.FOLDED)];
    expect(potTotal(buildPots(seats))).toBe(37 + 199 + 400 + 12);
  });
});

describe("splitting", () => {
  it("divides evenly when it can", () => {
    expect([...splitPot(300, [0, 1, 2], [{}, {}, {}], 0)]).toEqual([
      [1, 100],
      [2, 100],
      [0, 100],
    ]);
  });

  // odd chips go clockwise from the button, never to the lowest seat index
  it("gives the odd chip to the first winner after the button", () => {
    const payout = splitPot(101, [0, 2], [{}, {}, {}], 1);
    expect(payout.get(2)).toBe(51);
    expect(payout.get(0)).toBe(50);
  });

  it("never loses a chip to rounding", () => {
    for (const amount of [1, 2, 5, 7, 101, 1003]) {
      const payout = splitPot(amount, [0, 1, 2], [{}, {}, {}], 0);
      expect([...payout.values()].reduce((a, b) => a + b, 0)).toBe(amount);
    }
  });
});

describe("rake", () => {
  it("takes nothing before the flop", () => {
    expect(rakeFor(1000, 10, false)).toBe(0);
  });

  it("takes five percent once a flop is out", () => {
    expect(rakeFor(200, 10, true)).toBe(10);
  });

  it("caps at three big blinds", () => {
    expect(rakeFor(100000, 10, true)).toBe(RAKE_CAP_BB * 10);
  });

  it("takes nothing from an empty pot", () => {
    expect(rakeFor(0, 10, true)).toBe(0);
  });

  it("comes off the main pot first", () => {
    const pots = [
      { amount: 150, eligible: [0, 1, 2] },
      { amount: 300, eligible: [1, 2] },
    ];
    const { pots: raked, rake } = applyRake(pots, 10, true);
    expect(rake).toBe(22); // 5% of 450, under the 30 cap
    expect(raked[0].amount).toBe(128);
    expect(raked[1].amount).toBe(300);
    expect(raked.reduce((s, p) => s + p.amount, 0) + rake).toBe(450);
  });

  it("cannot rake more than is on the table", () => {
    const { pots, rake } = applyRake([{ amount: 4, eligible: [0, 1] }], 10, true);
    expect(rake).toBeLessThanOrEqual(4);
    expect(pots[0].amount + rake).toBe(4);
  });
});
