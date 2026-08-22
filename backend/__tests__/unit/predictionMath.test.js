const {
  ONE,
  PRICE_MIN,
  PRICE_MAX,
  DEFAULT_VIG_BPS,
  DEFAULT_IMPACT_BPS,
  targetSum,
  openingPrices,
  rampCost,
  toKp,
  rebalance,
  preview,
} = require("../../utils/predictionMath");

const total = (prices) => prices.reduce((s, n) => s + n, 0);

describe("the opening book", () => {
  it("adds up to one plus the vig, not to one", () => {
    for (const n of [2, 3, 4, 5, 7]) {
      expect(total(openingPrices(n))).toBe(targetSum());
    }
    // a fair two-way market reads 52 / 52, which is a bookmaker's 104% book
    expect(openingPrices(2)).toEqual([5200, 5200]);
  });

  it("splits evenly, give or take the rounding", () => {
    const prices = openingPrices(3);
    expect(Math.max(...prices) - Math.min(...prices)).toBeLessThanOrEqual(2);
  });

  it("refuses a market with fewer than two outcomes", () => {
    expect(() => openingPrices(1)).toThrow();
  });
});

describe("the curve", () => {
  it("charges the average across the fill, not the price it ends at", () => {
    const { avgBps, endBps } = rampCost(100, 4000, true);
    expect(endBps).toBe(5000);
    expect(avgBps).toBe(4500);
  });

  // the property the whole design rests on: no free money from churning
  it("makes a buy and an immediate sell of the same size come back to the start", () => {
    for (const start of [1500, 4000, 5200, 7000]) {
      for (const shares of [1, 10, 137, 400]) {
        const buy = rampCost(shares, start, true);
        const sell = rampCost(shares, buy.endBps, false);
        // symmetry is a property of the ramp, and the ramp stops at the cap. a trade that
        // reached it has lost the information needed to walk back, which is checked below.
        if (buy.endBps === PRICE_MAX) continue;
        expect(sell.endBps).toBe(start);
        expect(sell.twiceBps).toBe(buy.twiceBps);
      }
    }
  });

  // and where symmetry breaks, it has to break the right way
  it("costs the player, never the house, when a trade reaches a boundary", () => {
    for (const [start, shares] of [[7000, 400], [9000, 200], [9500, 900], [200, 500]]) {
      const buy = rampCost(shares, start, true);
      const sell = rampCost(shares, buy.endBps, false);
      const paid = toKp(buy.twiceBps, true);
      const returned = toKp(sell.twiceBps, false);
      expect(returned).toBeLessThanOrEqual(paid);
    }
  });

  it("ramps to the cap and then goes flat instead of running off the end", () => {
    const { endBps, avgBps } = rampCost(100000, 4000, true);
    expect(endBps).toBe(PRICE_MAX);
    expect(avgBps).toBeLessThanOrEqual(PRICE_MAX);
    expect(avgBps).toBeGreaterThan(4000);
  });

  it("does the same at the floor", () => {
    const { endBps } = rampCost(100000, 4000, false);
    expect(endBps).toBe(PRICE_MIN);
  });

  it("costs nothing for nothing", () => {
    expect(rampCost(0, 4000, true).twiceBps).toBe(0);
  });
});

describe("rebalancing", () => {
  it("keeps the book adding up after a move", () => {
    for (const start of [[3400, 3400, 3600], [5200, 5200], [2000, 2000, 3000, 3400]]) {
      for (const moved of [1500, 4000, 8000, 9800]) {
        const next = rebalance(start, 0, moved);
        expect(total(next)).toBe(targetSum());
      }
    }
  });

  it("never pushes an outcome under the floor or over the cap", () => {
    const next = rebalance([3400, 3400, 3600], 0, 20000);
    expect(Math.min(...next)).toBeGreaterThanOrEqual(PRICE_MIN);
    expect(Math.max(...next)).toBeLessThanOrEqual(PRICE_MAX);
  });

  // charging for one price and storing another is how a quote and a fill drift apart
  it("leaves the traded outcome exactly where the trade put it", () => {
    const next = rebalance([3400, 3400, 3600], 1, 5000);
    expect(next[1]).toBe(5000);
  });

  it("moves the others in proportion to where they were", () => {
    // the second sibling is twice the first, and stays twice the first
    const next = rebalance([4000, 2000, 4400], 0, 5000);
    expect(next[2] / next[1]).toBeCloseTo(4400 / 2000, 1);
  });

  it("splits evenly rather than dividing by zero when the rest have collapsed", () => {
    const next = rebalance([9000, PRICE_MIN, PRICE_MIN], 0, 5000);
    expect(total(next)).toBe(targetSum());
  });
});

describe("a quote", () => {
  it("prices a buy and hands back the whole new book", () => {
    const res = preview({ prices: [5200, 5200], index: 0, shares: 100, action: "buy" });
    expect(res.startBps).toBe(5200);
    expect(res.endBps).toBe(6200);
    expect(res.avgBps).toBe(5700);
    expect(res.amount).toBe(57);
    expect(total(res.prices)).toBe(targetSum());
  });

  it("rounds a buy up and a sell down, both toward the house", () => {
    // 1 share at 5201 is 0.5201 KP: a buy pays 1, a sell receives 0
    const buy = preview({ prices: [5201, 5199], index: 0, shares: 1, action: "buy" });
    const sell = preview({ prices: [5201, 5199], index: 0, shares: 1, action: "sell" });
    expect(buy.amount).toBe(1);
    expect(sell.amount).toBe(0);
  });

  it("turns away nonsense", () => {
    const bad = [
      { prices: [5200], index: 0, shares: 1, action: "buy" },
      { prices: [5200, 5200], index: 5, shares: 1, action: "buy" },
      { prices: [5200, 5200], index: 0, shares: 0, action: "buy" },
      { prices: [5200, 5200], index: 0, shares: 1.5, action: "buy" },
      { prices: [5200, 5200], index: 0, shares: -3, action: "buy" },
      { prices: [5200, 5200], index: 0, shares: 1, action: "hedge" },
    ];
    for (const input of bad) expect(preview(input).error).toBeTruthy();
  });
});

// the reason the vig exists. every one of these would be a hole in the economy.
describe("what the house must never lose", () => {
  it("charges more for one of every outcome than a resolution pays out", () => {
    for (const n of [2, 3, 4, 6]) {
      let prices = openingPrices(n);
      let paid = 0;
      for (let i = 0; i < n; i++) {
        const res = preview({ prices, index: i, shares: 1, action: "buy" });
        paid += res.amount;
        prices = res.prices;
      }
      // exactly one outcome pays 1 KP a share, and they bought one share of each
      expect(paid).toBeGreaterThanOrEqual(1);
    }
  });

  it("still charges more when the set is bought in bulk", () => {
    for (const shares of [10, 100, 500]) {
      let prices = openingPrices(3);
      let paid = 0;
      for (let i = 0; i < 3; i++) {
        const res = preview({ prices, index: i, shares, action: "buy" });
        paid += res.amount;
        prices = res.prices;
      }
      expect(paid).toBeGreaterThan(shares);
    }
  });

  // buying and selling in a loop must not print money
  it("never pays out more than it took across a churn", () => {
    let prices = openingPrices(3);
    let net = 0;
    for (let round = 0; round < 200; round++) {
      const index = round % 3;
      const shares = 5 + (round % 23);
      const buy = preview({ prices, index, shares, action: "buy" });
      net += buy.amount;
      prices = buy.prices;

      const sell = preview({ prices, index, shares, action: "sell" });
      net -= sell.amount;
      prices = sell.prices;
    }
    expect(net).toBeGreaterThanOrEqual(0);
    expect(total(prices)).toBe(targetSum());
  });

  // a thousand random trades, then resolve to whichever outcome is worst for the house
  it("survives a random market ending the worst way it can", () => {
    let prices = openingPrices(4);
    const held = [0, 0, 0, 0];
    let taken = 0;

    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 1000; i++) {
      const index = Math.floor(rnd() * 4);
      const shares = 1 + Math.floor(rnd() * 60);
      const selling = held[index] > 0 && rnd() < 0.4;
      const size = selling ? Math.min(shares, held[index]) : shares;
      if (size <= 0) continue;

      const res = preview({ prices, index, shares: size, action: selling ? "sell" : "buy" });
      taken += selling ? -res.amount : res.amount;
      held[index] += selling ? -size : size;
      prices = res.prices;
      expect(total(prices)).toBe(targetSum());
    }

    const worstPayout = Math.max(...held);
    expect(taken).toBeGreaterThanOrEqual(worstPayout);
  });
});
