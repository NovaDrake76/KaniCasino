import type { LotteryState } from "../services/lottery/LotteryService";

// one page's worth of server state the hook and view tests share: an open draw two hours out, a settled one before it
export const SEED = "abc";
export const SEED_HASH = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

export const lotteryState = (overrides: Partial<LotteryState> = {}): LotteryState => {
  const now = Date.now();
  return {
    serverTime: new Date(now).toISOString(),
    rules: {
      pool: 20,
      pick: 3,
      price: 100,
      cap: 50,
      drawHourUtc: 20,
      salesCloseMs: 60000,
      prizes: { 1: 100, 2: 300 },
      jackpotBase: 25000,
      jackpotShare: 25,
      combinations: 1140,
    },
    draw: {
      number: 2,
      status: "open",
      drawAt: new Date(now + 2 * 3600 * 1000).toISOString(),
      salesCloseAt: new Date(now + 2 * 3600 * 1000 - 60000).toISOString(),
      jackpot: 25175,
      tickets: 4,
      carried: 1,
      seedHash: "f".repeat(64),
    },
    last: {
      number: 1,
      drawAt: new Date(now - 22 * 3600 * 1000).toISOString(),
      settledAt: new Date(now - 22 * 3600 * 1000).toISOString(),
      numbers: [5, 7, 19],
      jackpot: 25075,
      jackpotEach: 0,
      tickets: 3,
      carried: 0,
      winners: { m1: 2, m2: 1, m3: 0 },
      jackpotWinners: [],
      seedHash: SEED_HASH,
      serverSeed: SEED,
    },
    me: {
      tickets: [{ numbers: [1, 2, 3] }],
      count: 1,
      left: 49,
      last: { number: 1, tickets: [{ numbers: [5, 7, 8], matches: 2, prize: 300 }, { numbers: [1, 2, 3], matches: 0, prize: 0 }], won: 300 },
    },
    ...overrides,
  };
};
