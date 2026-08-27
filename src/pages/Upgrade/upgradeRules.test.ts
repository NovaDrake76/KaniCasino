import { describe, it, expect } from "vitest";
import { sourceRarities, targetRarities, calculateSuccessRate } from "./upgradeRules";

const staked = (...rarities: number[]) => rarities.map((rarity) => ({ item: { rarity: String(rarity), baseValue: 100 } }));
const target = (rarity: number, baseValue = 1000) => ({ rarity: String(rarity), baseValue });

describe("what the upgrade screen is allowed to offer", () => {
  it("offers every rarity while nothing is picked", () => {
    expect(targetRarities([])).toEqual([1, 2, 3, 4, 5]);
    expect(sourceRarities([], null)).toEqual([1, 2, 3, 4, 5]);
  });

  it("caps the outcome at two rarities above what is staked", () => {
    expect(targetRarities(staked(1))).toEqual([1, 2, 3]);
    expect(targetRarities(staked(3))).toEqual([3, 4, 5]);
    expect(targetRarities(staked(5))).toEqual([5]);
  });

  it("narrows the outcome to what the whole pile can reach", () => {
    expect(targetRarities(staked(1, 3))).toEqual([3]);
    expect(targetRarities(staked(2, 3))).toEqual([3, 4]);
  });

  it("stakes only what sits inside the gap under the target", () => {
    expect(sourceRarities([], target(5))).toEqual([3, 4, 5]);
    expect(sourceRarities([], target(2))).toEqual([1, 2]);
  });

  it("keeps a further pick compatible with the pile even before a target is chosen", () => {
    expect(sourceRarities(staked(1), null)).toEqual([1, 2, 3]);
    expect(sourceRarities(staked(4), target(5))).toEqual([3, 4, 5]);
  });

  it("quotes nothing for a combination the server would refuse", () => {
    expect(calculateSuccessRate(staked(1), target(5))).toBe(0);
    expect(calculateSuccessRate(staked(5), target(4))).toBe(0);
    expect(calculateSuccessRate(staked(3), target(5))).toBeGreaterThan(0);
  });
});
