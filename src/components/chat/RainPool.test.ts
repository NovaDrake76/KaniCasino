import { describe, it, expect } from "vitest";
import { isBuilding, remainingShare, splitRemaining } from "./RainPool";

describe("the bar under the rain pool", () => {
  const start = 1000;
  const end = start + 30 * 60 * 1000;

  it("is full at the top of the round and empty at the end", () => {
    expect(remainingShare(end, start, start)).toBe(1);
    expect(remainingShare(end, start, end)).toBe(0);
  });

  it("drains rather than fills, so it reads as time running out", () => {
    const half = remainingShare(end, start, start + 15 * 60 * 1000);
    expect(half).toBeCloseTo(0.5, 2);
    expect(remainingShare(end, start, start + 25 * 60 * 1000)).toBeLessThan(half);
  });

  it("does not run past either end when the clock is out", () => {
    expect(remainingShare(end, start, start - 60000)).toBe(1);
    expect(remainingShare(end, start, end + 60000)).toBe(0);
  });

  it("survives a round with no span rather than dividing by nothing", () => {
    expect(remainingShare(start, start, start)).toBe(0);
  });
});

describe("the countdown", () => {
  it("counts minutes and seconds", () => {
    expect(splitRemaining(90000)).toBe("01:30");
    expect(splitRemaining(59000)).toBe("00:59");
  });

  it("shows nothing left rather than a negative", () => {
    expect(splitRemaining(-5000)).toBe("00:00");
    expect(splitRemaining(0)).toBe("00:00");
  });
});

describe("a pool that is not big enough to fall", () => {
  it("is building rather than counting down", () => {
    // the reported bug: a pool of 4 against a floor of 100 showed a countdown, a join
    // button and a figure, then nothing happened and nothing said why
    expect(isBuilding(4, 100)).toBe(true);
    expect(isBuilding(99, 100)).toBe(true);
  });

  it("is ready the moment it reaches the floor", () => {
    expect(isBuilding(100, 100)).toBe(false);
    expect(isBuilding(2500, 100)).toBe(false);
  });

  it("treats an empty pool as building, not as ready", () => {
    expect(isBuilding(0, 100)).toBe(true);
  });
});
