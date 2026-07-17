const { winPayout, COINFLIP_RTP } = require("../../games/coinFlip");

// the coin itself is fair, so the edge lives entirely in the payout
const edgeAt = (bet) => 1 - (0.5 * winPayout(bet)) / bet;

describe("coin flip payout", () => {
  test("a win pays 1.94x the stake", () => {
    expect(winPayout(100)).toBe(194);
    expect(winPayout(1000)).toBe(1940);
    expect(winPayout(50000)).toBe(97000);
  });

  test("the edge is 1 - COINFLIP_RTP on any bet the rounding does not dominate", () => {
    for (const bet of [50, 100, 250, 1000, 12345, 1000000]) {
      expect(edgeAt(bet)).toBeCloseTo(1 - COINFLIP_RTP, 3);
    }
  });

  test("no bet size rounds into a player edge", () => {
    // this is the whole point: paying 2x on a fair coin was an edge of exactly zero
    for (let bet = 1; bet <= 5000; bet++) {
      expect(edgeAt(bet)).toBeGreaterThan(0);
    }
  });

  test("the payout is always whole KP", () => {
    for (const bet of [1, 3, 7, 99, 12345]) {
      expect(Number.isInteger(winPayout(bet))).toBe(true);
    }
  });

  test("a win still returns more than the stake", () => {
    // floor must never make winning worse than not playing
    for (let bet = 1; bet <= 200; bet++) {
      expect(winPayout(bet)).toBeGreaterThanOrEqual(bet);
    }
  });
});
