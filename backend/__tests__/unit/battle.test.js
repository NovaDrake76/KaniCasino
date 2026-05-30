const { modeConfig, teamTotals, pickWinningTeam, splitItemsEvenly } = require("../../utils/battle");

describe("battle modes", () => {
  test("mode layouts", () => {
    expect(modeConfig("1v1")).toEqual({ slots: 2, teams: [0, 1] });
    expect(modeConfig("1v1v1v1")).toEqual({ slots: 4, teams: [0, 1, 2, 3] });
    expect(modeConfig("2v2")).toEqual({ slots: 4, teams: [0, 0, 1, 1] });
    expect(modeConfig("nope")).toBeNull();
  });
});

describe("team totals + winner", () => {
  const players = [
    { team: 0, total: 100 },
    { team: 0, total: 50 },
    { team: 1, total: 200 },
    { team: 1, total: 10 },
  ];

  test("sums per team", () => {
    expect(teamTotals(players)).toEqual({ 0: 150, 1: 210 });
  });

  test("highest team wins normally", () => {
    expect(pickWinningTeam(players)).toBe(1);
  });

  test("lowest team wins in baka mode", () => {
    expect(pickWinningTeam(players, true)).toBe(0);
  });

  test("ties are broken by rng", () => {
    const tied = [
      { team: 0, total: 100 },
      { team: 1, total: 100 },
    ];
    expect(pickWinningTeam(tied, false, () => 0)).toBe(0);
    expect(pickWinningTeam(tied, false, () => 0.99)).toBe(1);
  });
});

describe("even item split", () => {
  test("one recipient takes everything", () => {
    const items = [{ baseValue: 10 }, { baseValue: 20 }];
    const out = splitItemsEvenly(items, 1);
    expect(out[0]).toHaveLength(2);
  });

  test("splits two recipients close to even by value", () => {
    const items = [{ baseValue: 100 }, { baseValue: 90 }, { baseValue: 50 }, { baseValue: 40 }];
    const [a, b] = splitItemsEvenly(items, 2);
    const sum = (arr) => arr.reduce((s, i) => s + i.baseValue, 0);
    // total 280; greedy gives 100+40=140 and 90+50=140
    expect(sum(a) + sum(b)).toBe(280);
    expect(Math.abs(sum(a) - sum(b))).toBeLessThanOrEqual(20);
  });
});
