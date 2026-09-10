import { describe, it, expect } from "vitest";
import { clock, fillAt, kp, msUntil, payout, takeBetween } from "./potMath";

const CYCLE = 8 * 60000;
const now = Date.parse("2026-09-10T12:00:00Z");
const fullIn = (ms: number) => new Date(now + ms).toISOString();
const NBSP = String.fromCharCode(160);

describe("ticking the pot between requests", () => {
  it("reads the fill off when the pot will be full", () => {
    expect(fillAt(fullIn(CYCLE), CYCLE, now)).toBe(0);
    expect(fillAt(fullIn(CYCLE / 2), CYCLE, now)).toBeCloseTo(0.5);
    expect(fillAt(fullIn(0), CYCLE, now)).toBe(1);
    expect(fillAt(fullIn(-CYCLE), CYCLE, now)).toBe(1);
  });

  it("prices a fill the way the server does", () => {
    expect(payout(1000, 1)).toBe(1000);
    expect(payout(1000, 0.5)).toBe(450);
    expect(payout(1000, 0)).toBe(0);
  });

  it("makes a run of clicks add up to what one take of the whole run pays", () => {
    let sum = 0;
    let last = 0;
    for (const f of [0.1, 0.25, 0.4, 0.7, 1]) {
      sum += takeBetween(1000, last, f);
      last = f;
    }
    expect(sum).toBe(payout(1000, 1));
    expect(takeBetween(1000, 0.5, 0.4)).toBe(0);
  });

  it("counts down to a fill", () => {
    expect(msUntil(fullIn(CYCLE), CYCLE, 0.1, now)).toBe(CYCLE * 0.1);
    expect(msUntil(fullIn(CYCLE), CYCLE, 1, now)).toBe(CYCLE);
    expect(msUntil(fullIn(0), CYCLE, 1, now)).toBe(0);
  });

  it("shows a clock the way the old button did", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(61000)).toBe("1:01");
    expect(clock(CYCLE)).toBe("8:00");
  });

  it("writes an amount the way the wallet does", () => {
    expect(kp(1234)).toBe(`K₽${NBSP}1,234`);
    expect(kp(0)).toBe(`K₽${NBSP}0`);
  });
});
