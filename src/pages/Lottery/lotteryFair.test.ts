import { describe, it, expect } from "vitest";
import { canVerify, checkDraw, drawNumbers, drawWith, sha256Hex } from "./lotteryFair";

// the same vectors backend/__tests__/unit/lotteryMath.test.js pins, so the browser check and the settlement agree
describe("checking a draw in the browser", () => {
  it("can run here", () => {
    expect(canVerify()).toBe(true);
  });

  it("draws what the server drew from the same seed and number", async () => {
    expect(await drawNumbers("abc", 1)).toEqual([5, 7, 19]);
    expect(await drawNumbers("abc", 2)).not.toEqual([5, 7, 19]);
  });

  it("shuffles the same way", () => {
    expect(drawWith([0, 0, 0])).toEqual([1, 2, 3]);
    expect(drawWith([0.999999, 0.999999, 0.999999])).toEqual([1, 2, 20]);
    expect(drawWith([0.5, 0, 0])).toEqual([2, 3, 11]);
  });

  it("hashes like sha-256", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("passes a real draw and fails a doctored one", async () => {
    const seedHash = await sha256Hex("abc");
    expect(await checkDraw({ number: 1, serverSeed: "abc", seedHash, numbers: [19, 5, 7] })).toEqual({
      commitmentValid: true,
      outcomeValid: true,
      recomputed: [5, 7, 19],
    });
    const doctored = await checkDraw({ number: 1, serverSeed: "abc", seedHash, numbers: [5, 7, 18] });
    expect(doctored.outcomeValid).toBe(false);
    expect((await checkDraw({ number: 1, serverSeed: "abd", seedHash, numbers: [5, 7, 19] })).commitmentValid).toBe(false);
  });
});
