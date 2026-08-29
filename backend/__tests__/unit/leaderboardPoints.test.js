const { TX } = require("../../utils/economy");
const { pointsFor, MULTIPLIERS, SCORING_TYPES, TABLE } = require("../../utils/leaderboardPoints");

describe("race points", () => {
  test("a wager scores its amount times the game's multiplier", () => {
    expect(pointsFor(TX.CASE_OPEN, 1000)).toBe(1500);
    expect(pointsFor(TX.CRASH_BET, 1000)).toBe(1300);
    expect(pointsFor(TX.COINFLIP_BET, 1000)).toBe(1000);
    expect(pointsFor(TX.DICE_BET, 1000)).toBe(400);
  });

  test("the lowest-edge games pay least, which is the point of the multiplier", () => {
    // dice, hi-lo, mines and blackjack all sit at or under a 1% edge. weeklyWinnings
    // rewarded them most, because a near-even-money win credited its whole payout.
    for (const type of [TX.DICE_BET, TX.HILO_BET, TX.MINES_BET, TX.BLACKJACK_BET]) {
      expect(MULTIPLIERS[type]).toBeLessThan(MULTIPLIERS[TX.COINFLIP_BET]);
      expect(MULTIPLIERS[type]).toBeLessThan(MULTIPLIERS[TX.CASE_OPEN]);
    }
  });

  test("a 16m dice grind scores under a 12m crash session", () => {
    // the real 30-day numbers: the dice bot wagered more than the crash whale and would
    // have topped a volume-only board
    expect(pointsFor(TX.DICE_BET, 16043681)).toBeLessThan(pointsFor(TX.CRASH_BET, 12520817));
  });

  test("points are whole numbers", () => {
    expect(Number.isInteger(pointsFor(TX.PREDICTION_BUY, 333))).toBe(true);
    expect(pointsFor(TX.PREDICTION_BUY, 333)).toBe(99);
  });

  test("anything that is not a wager scores nothing", () => {
    // the bonus, a market trade and a mission reward are not bets and must never count
    for (const type of [TX.BONUS, TX.MARKET_BUY, TX.MISSION_REWARD, TX.AD_REWARD, TX.RACE_PRIZE]) {
      expect(pointsFor(type, 100000)).toBe(0);
      expect(SCORING_TYPES).not.toContain(type);
    }
  });

  test("a zero or negative amount scores nothing", () => {
    expect(pointsFor(TX.CRASH_BET, 0)).toBe(0);
    expect(pointsFor(TX.CRASH_BET, -500)).toBe(0);
  });

  test("every scoring type is in the table players are shown, and nothing else is", () => {
    expect(TABLE.map((g) => g.type).sort()).toEqual([...SCORING_TYPES].sort());
  });
});
