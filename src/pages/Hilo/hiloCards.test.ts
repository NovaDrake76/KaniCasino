import { describe, it, expect } from "vitest";
import { rankOf, hiChance, loChance, RANKS } from "./hiloCards";

describe("hilo card odds", () => {
    it("ranks a card 0..12", () => {
        expect(rankOf(11)).toBe(11); // queen of spades
        expect(rankOf(24)).toBe(11); // queen of hearts
        expect(rankOf(0)).toBe(0); // ace
        expect(rankOf(12)).toBe(12); // king
    });

    it("matches the Stake queen odds", () => {
        expect(hiChance(11)).toBeCloseTo(2 / 13, 8);
        expect(loChance(11)).toBeCloseTo(12 / 13, 8);
    });

    it("handles the ace and king extremes", () => {
        expect(hiChance(0)).toBeCloseTo(1, 8);
        expect(loChance(0)).toBeCloseTo(1 / 13, 8);
        expect(hiChance(12)).toBeCloseTo(1 / 13, 8);
        expect(loChance(12)).toBeCloseTo(1, 8);
    });

    it("has a 13-rank deck", () => {
        expect(RANKS).toBe(13);
    });
});
