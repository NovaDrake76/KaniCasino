import { describe, it, expect } from "vitest";
import { TILES, gemsFor, multiplierFor, payoutFor, MAX_PAYOUT } from "./minesGrid";

describe("mines grid math", () => {
    it("gems fill the grid minus the mines", () => {
        expect(gemsFor(3)).toBe(22);
        expect(gemsFor(1)).toBe(24);
    });

    it("multiplier matches the backend formula and starts at 1", () => {
        expect(multiplierFor(3, 0)).toBe(1);
        expect(multiplierFor(3, 1)).toBeCloseTo(0.99 * (25 / 22), 8);
        expect(multiplierFor(1, 24)).toBeCloseTo(0.99 * 25, 6);
    });

    it("multiplier rises with each gem revealed", () => {
        let prev = 0;
        for (let g = 1; g <= 20; g++) {
            const m = multiplierFor(5, g);
            expect(m).toBeGreaterThan(prev);
            prev = m;
        }
    });

    it("payout caps at the max win", () => {
        expect(payoutFor(10000, 12, 13)).toBe(MAX_PAYOUT);
        expect(payoutFor(100, 3, 1)).toBeCloseTo(100 * multiplierFor(3, 1), 6);
    });

    it("the grid is 25 tiles", () => {
        expect(TILES).toBe(25);
    });
});
