import { describe, it, expect } from "vitest";
import {
    GROWTH,
    MIN_WINDOW_S,
    multiplierAt,
    elapsedFor,
    axisRange,
    pointFor,
    tickStep,
    yTicks,
    xTicks,
} from "./crashCurve";

describe("crash curve math", () => {
    it("starts at 1x and matches the backend growth rate", () => {
        expect(multiplierAt(0)).toBe(1);
        expect(multiplierAt(10)).toBeCloseTo(Math.exp(10 * GROWTH), 10);
    });

    it("elapsedFor inverts multiplierAt", () => {
        for (const m of [1, 1.5, 2.4, 10, 100]) {
            expect(multiplierAt(elapsedFor(m))).toBeCloseTo(m, 10);
        }
        // never negative, even for a sub-1 input
        expect(elapsedFor(0.5)).toBe(0);
    });

    it("axis ranges hold their minimums early and track the tip later", () => {
        const early = axisRange(1, 1.06);
        expect(early.xMax).toBe(MIN_WINDOW_S);
        expect(early.yMax).toBe(2);

        const late = axisRange(40, 11);
        expect(late.xMax).toBe(40);
        expect(late.yMax).toBeCloseTo(11 * 1.18, 10);
    });

    it("maps the origin to the bottom-left and the tip near the top", () => {
        const range = axisRange(10, 1.8);
        const origin = pointFor(0, 1, range, 400, 300);
        expect(origin).toEqual({ x: 0, y: 300 });

        const tip = pointFor(10, 1.8, range, 400, 300);
        expect(tip.x).toBe(400);
        expect(tip.y).toBeGreaterThan(0);
        expect(tip.y).toBeLessThan(300);
    });

    it("tick steps follow the 1/2/5 ladder", () => {
        expect(tickStep(1, 4)).toBe(0.5);
        expect(tickStep(4, 4)).toBe(1);
        expect(tickStep(8, 4)).toBe(2);
        expect(tickStep(40, 4)).toBe(10);
    });

    it("tick lists stay small at any zoom", () => {
        for (const yMax of [2, 5, 23, 480]) {
            const ticks = yTicks(yMax);
            expect(ticks[0]).toBe(1);
            expect(ticks.length).toBeLessThanOrEqual(6);
            expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(yMax);
        }
        for (const xMax of [8, 27, 120]) {
            const ticks = xTicks(xMax);
            expect(ticks[0]).toBe(0);
            expect(ticks.length).toBeLessThanOrEqual(7);
        }
    });
});
