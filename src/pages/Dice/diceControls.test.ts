import { describe, it, expect } from "vitest";
import {
    OUTCOMES,
    winCountFor,
    winChanceFor,
    multiplierFor,
    clampTarget,
    targetForWinChance,
    targetForMultiplier,
    controlsFor,
} from "./diceControls";

describe("dice controls", () => {
    it("win chance and multiplier match the Stake table", () => {
        expect(multiplierFor(4950)).toBe(2);
        expect(winChanceFor(4950)).toBeCloseTo(49.5, 6);
        expect(multiplierFor(200)).toBe(49.5);
        expect(multiplierFor(2000)).toBe(4.95);
        expect(multiplierFor(6500)).toBeCloseTo(1.5231, 4);
    });

    it("over and under targets are complementary about OUTCOMES", () => {
        expect(winCountFor(5050, "over")).toBe(OUTCOMES - 5050);
        expect(winCountFor(5050, "under")).toBe(5050);
    });

    it("targets round-trip through win chance and multiplier", () => {
        const c = controlsFor(5050, "over");
        expect(targetForWinChance(c.winChance, "over")).toBe(5050);
        expect(targetForMultiplier(c.multiplier, "over")).toBe(5050);
    });

    it("clamps targets into the 2%..98% band per direction", () => {
        // under: winCount == target, so [200, 9800]
        expect(clampTarget(50, "under")).toBe(200);
        expect(clampTarget(9999, "under")).toBe(9800);
        // over: winCount == OUTCOMES - target, so target in [200, 9800] too
        expect(clampTarget(50, "over")).toBe(200);
        expect(clampTarget(9999, "over")).toBe(9800);
    });

    it("derived controls expose an exact payout-on-win", () => {
        const c = controlsFor(5050, "over");
        expect(c.multiplier).toBe(2);
        expect(c.payoutOnWin(100)).toBe(200);
    });
});
