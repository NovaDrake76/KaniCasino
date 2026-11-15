const crypto = require("crypto");
const M = require("../../utils/lotteryMath");

// every 3-number draw from 1..20, in order
const everyDraw = () => {
  const out = [];
  for (let a = 1; a <= 20; a++) for (let b = a + 1; b <= 20; b++) for (let c = b + 1; c <= 20; c++) out.push([a, b, c]);
  return out;
};

describe("the combinatorics", () => {
  test("there are 1,140 draws and a ticket matches 0, 1, 2 or 3 of them in 680, 408, 51 and 1", () => {
    expect(M.COMBINATIONS).toBe(1140);
    expect([0, 1, 2, 3].map(M.waysToMatch)).toEqual([680, 408, 51, 1]);
    expect([0, 1, 2, 3].map(M.waysToMatch).reduce((a, b) => a + b, 0)).toBe(1140);
  });

  test("counting every draw against one ticket gives the same split", () => {
    const counts = [0, 0, 0, 0];
    for (const draw of everyDraw()) counts[M.matchCount([4, 11, 17], draw)] += 1;
    expect(counts).toEqual([680, 408, 51, 1]);
  });

  test("the fixed prizes return 49.21% of the price", () => {
    expect(M.FIXED_RTP).toBeCloseTo((408 * 100 + 51 * 300) / (1140 * 100), 12);
    expect(Math.round(M.FIXED_RTP * 10000) / 100).toBe(49.21);
  });

  test("with the pot share and the base the house funds once every 1,140 tickets, a ticket returns about 96.1%", () => {
    const rtp = M.FIXED_RTP + M.JACKPOT_SHARE / M.PRICE + M.JACKPOT_BASE / M.COMBINATIONS / M.PRICE;
    expect(Math.round(rtp * 1000) / 10).toBe(96.1);
    // a lone ticket only pays for itself once the pot is past about 57,900
    expect(Math.round(((1 - M.FIXED_RTP) * M.PRICE * M.COMBINATIONS) / 100) * 100).toBe(57900);
  });

  test("a match pays 100 for one, 300 for two, and the fixed tiers pay nothing for three", () => {
    expect([0, 1, 2, 3].map(M.fixedPrize)).toEqual([0, 100, 300, 0]);
    expect(M.PRICE).toBe(100);
    expect(M.JACKPOT_BASE).toBe(25000);
    expect(M.JACKPOT_SHARE).toBe(25);
    expect(M.CAP).toBe(50);
  });

  test("the jackpot splits in whole K₽ and the remainder stays", () => {
    expect(M.jackpotShare(25000, 1)).toBe(25000);
    expect(M.jackpotShare(25001, 2)).toBe(12500);
    expect(M.jackpotShare(31000, 3)).toBe(10333);
    expect(M.jackpotShare(25000, 0)).toBe(0);
  });
});

describe("counting matches", () => {
  test("order never matters", () => {
    expect(M.matchCount([3, 7, 19], [19, 3, 7])).toBe(3);
    expect(M.matchCount([7, 3, 19], [1, 7, 20])).toBe(1);
    expect(M.matchCount([1, 2, 3], [4, 5, 6])).toBe(0);
    expect(M.matchCount([1, 2, 3], [3, 2, 9])).toBe(2);
  });
});

describe("a pick", () => {
  test("is three distinct whole numbers from 1 to 20, stored sorted", () => {
    expect(M.validPick([19, 3, 7])).toEqual([3, 7, 19]);
    expect(M.validPick([1, 20, 10])).toEqual([1, 10, 20]);
  });

  test("anything else is refused", () => {
    for (const bad of [[1, 2], [1, 2, 3, 4], [0, 1, 2], [1, 2, 21], [1, 1, 2], [1.5, 2, 3], ["1", 2, 3], null, "1,2,3", [1, 2, null]]) {
      expect(M.validPick(bad)).toBeNull();
    }
  });

  test("a purchase is 1 to 50 picks, duplicates allowed, and one bad pick refuses all of it", () => {
    expect(M.normalizePicks([[3, 2, 1], [3, 2, 1]])).toEqual([[1, 2, 3], [1, 2, 3]]);
    expect(M.normalizePicks(Array.from({ length: 50 }, () => [1, 2, 3]))).toHaveLength(50);
    expect(M.normalizePicks(Array.from({ length: 51 }, () => [1, 2, 3]))).toBeNull();
    expect(M.normalizePicks([])).toBeNull();
    expect(M.normalizePicks([[1, 2, 3], [1, 1, 2]])).toBeNull();
    expect(M.normalizePicks({ 0: [1, 2, 3] })).toBeNull();
  });
});

describe("the drawn numbers", () => {
  test("come from the seed and the draw number alone, the same every time", () => {
    expect(M.drawNumbers("abc", 1)).toEqual([5, 7, 19]);
    expect(M.drawNumbers("abc", 1)).toEqual(M.drawNumbers("abc", 1));
    expect(M.drawNumbers("abc", 2)).not.toEqual(M.drawNumbers("abc", 1));
  });

  test("use the site's hmac message with lottery in place of the client seed and the draw number as the nonce", () => {
    const seed = "f".repeat(64);
    const floats = [0, 1, 2].map((cursor) => {
      const digest = crypto.createHmac("sha256", seed).update(`lottery:7:${cursor}`).digest();
      return digest[0] / 256 + digest[1] / 256 ** 2 + digest[2] / 256 ** 3 + digest[3] / 256 ** 4;
    });
    expect(M.drawNumbers(seed, 7)).toEqual(M.drawWith((i) => floats[i]));
  });

  test("the shuffle is a partial fisher-yates over 1..20", () => {
    expect(M.drawWith(() => 0)).toEqual([1, 2, 3]);
    expect(M.drawWith(() => 0.999999)).toEqual([1, 2, 20]);
    // position 0 takes 1 + floor(0.5 * 20) = 11, then 11 moves to where 1 was
    expect(M.drawWith((i) => [0.5, 0, 0][i])).toEqual([2, 3, 11]);
  });

  test("are always three distinct numbers in range, and every number turns up about as often", () => {
    const seen = new Array(21).fill(0);
    const runs = 6000;
    for (let i = 0; i < runs; i++) {
      const numbers = M.drawNumbers(crypto.randomBytes(16).toString("hex"), i + 1);
      expect(new Set(numbers).size).toBe(3);
      expect(numbers.every((n) => n >= 1 && n <= 20)).toBe(true);
      expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
      for (const n of numbers) seen[n] += 1;
    }
    const expected = (runs * 3) / 20;
    for (let n = 1; n <= 20; n++) expect(Math.abs(seen[n] - expected)).toBeLessThan(expected * 0.15);
  });
});

describe("the clock", () => {
  test("a draw is at 20:00 utc and sales close a minute before", () => {
    expect(M.nextDrawAt(new Date("2026-11-14T10:00:00Z")).toISOString()).toBe("2026-11-14T20:00:00.000Z");
    expect(M.salesCloseAt(new Date("2026-11-14T20:00:00Z")).toISOString()).toBe("2026-11-14T19:59:00.000Z");
    expect(M.salesOpen(new Date("2026-11-14T20:00:00Z"), new Date("2026-11-14T19:58:59Z"))).toBe(true);
    expect(M.salesOpen(new Date("2026-11-14T20:00:00Z"), new Date("2026-11-14T19:59:00Z"))).toBe(false);
  });

  test("a draw opened inside the last minute goes to the next day rather than open already closed", () => {
    expect(M.nextDrawAt(new Date("2026-11-14T19:59:30Z")).toISOString()).toBe("2026-11-15T20:00:00.000Z");
    expect(M.nextDrawAt(new Date("2026-11-14T20:00:00Z")).toISOString()).toBe("2026-11-15T20:00:00.000Z");
    expect(M.nextDrawAt(new Date("2026-11-14T23:30:00Z")).toISOString()).toBe("2026-11-15T20:00:00.000Z");
  });
});
