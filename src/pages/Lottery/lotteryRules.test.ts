import { describe, it, expect } from "vitest";
import {
  CAP,
  COMBINATIONS,
  FIXED_RTP,
  JACKPOT_BASE,
  JACKPOT_SHARE,
  PRICE,
  PRIZES,
  addQuickPicks,
  addToSlip,
  formatCountdown,
  kpText,
  matchedIn,
  oneIn,
  quickPick,
  removeFromSlip,
  repeatTickets,
  slipRoom,
  slipTotal,
  togglePick,
  waysToMatch,
} from "./lotteryRules";

// the same numbers backend/__tests__/unit/lotteryMath.test.js asserts, so a rule edited on one side only fails a test
describe("the rules the page quotes", () => {
  it("has 1,140 draws, split 680, 408, 51 and 1 by matches", () => {
    expect(COMBINATIONS).toBe(1140);
    expect([0, 1, 2, 3].map(waysToMatch)).toEqual([680, 408, 51, 1]);
  });

  it("returns 49.21% through the fixed prizes, and about 96.1% with the pot share and the base", () => {
    expect(Math.round(FIXED_RTP * 10000) / 100).toBe(49.21);
    expect(PRIZES).toEqual({ 1: 100, 2: 300 });
    expect(JACKPOT_SHARE).toBe(25);
    const rtp = FIXED_RTP + JACKPOT_SHARE / PRICE + JACKPOT_BASE / COMBINATIONS / PRICE;
    expect(Math.round(rtp * 1000) / 10).toBe(96.1);
  });

  it("states the odds as one in n", () => {
    expect([1, 2, 3].map(oneIn)).toEqual(["2.8", "22.4", "1,140"]);
  });

  it("counts matched numbers whatever the order", () => {
    expect(matchedIn([3, 7, 19], [19, 1, 3])).toBe(2);
  });
});

describe("picking", () => {
  it("picks, unpicks, and ignores a fourth number until one is let go", () => {
    let pick: number[] = [];
    for (const n of [4, 9, 15]) pick = togglePick(pick, n);
    expect(pick).toEqual([4, 9, 15]);
    const same = togglePick(pick, 2);
    expect(same).toBe(pick);
    pick = togglePick(pick, 9);
    expect(pick).toEqual([4, 15]);
    expect(togglePick(pick, 2)).toEqual([4, 15, 2]);
    expect(togglePick([], 21)).toEqual([]);
  });

  it("quick picks three distinct numbers in range, sorted", () => {
    for (let i = 0; i < 200; i++) {
      const pick = quickPick();
      expect(new Set(pick).size).toBe(3);
      expect(pick.every((n) => n >= 1 && n <= 20)).toBe(true);
      expect([...pick].sort((a, b) => a - b)).toEqual(pick);
    }
    expect(quickPick(() => 0)).toEqual([1, 2, 3]);
  });
});

describe("the slip", () => {
  it("never holds more than the cap less the tickets already bought", () => {
    expect(slipRoom(0, 0)).toBe(CAP);
    expect(slipRoom(45, 3)).toBe(2);
    expect(slipRoom(50, 0)).toBe(0);
    expect(slipRoom(49, 5)).toBe(0);
  });

  it("takes a complete pick, sorted, only while there is room", () => {
    expect(addToSlip([], [9, 2, 5], 0)).toEqual([[2, 5, 9]]);
    expect(addToSlip([], [9, 2], 0)).toEqual([]);
    const full = Array.from({ length: 2 }, () => [1, 2, 3]);
    expect(addToSlip(full, [4, 5, 6], 48)).toBe(full);
  });

  it("adds quick picks up to what is left of the cap", () => {
    expect(addQuickPicks([], 10, 0)).toHaveLength(10);
    expect(addQuickPicks([[1, 2, 3]], 10, 45)).toHaveLength(5);
    expect(addQuickPicks([], 5, 50)).toHaveLength(0);
  });

  it("repeats the last draw's tickets in their order, duplicates kept, up to what is left of the cap", () => {
    const last = [[8, 5, 7], [1, 2, 3], [5, 7, 8]];
    expect(repeatTickets([], last, 0)).toEqual([[5, 7, 8], [1, 2, 3], [5, 7, 8]]);
    expect(repeatTickets([[9, 10, 11]], last, 47)).toEqual([[9, 10, 11], [5, 7, 8], [1, 2, 3]]);
    expect(repeatTickets([], last, 50)).toEqual([]);
  });

  it("removes one ticket and prices the rest", () => {
    const slip = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    expect(removeFromSlip(slip, 1)).toEqual([[1, 2, 3], [7, 8, 9]]);
    expect(slipTotal(slip)).toBe(300);
    expect(kpText(400).replace(/\s/g, " ")).toBe("K₽ 400");
  });
});

describe("the countdown", () => {
  it("reads hours, minutes and seconds, and never goes below zero", () => {
    expect(formatCountdown(3 * 3600 * 1000 + 5 * 60 * 1000 + 9 * 1000)).toBe("3:05:09");
    expect(formatCountdown(59 * 1000 + 999)).toBe("00:59");
    expect(formatCountdown(10 * 60 * 1000)).toBe("10:00");
    expect(formatCountdown(-5000)).toBe("00:00");
  });
});
