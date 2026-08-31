import { describe, it, expect } from "vitest";
import { TOP_SLOT_TICKS, topSlotAt, topSlotStart } from "./Gift.services";

describe("the top slot row", () => {
  it("ends its run on the rung that actually won", () => {
    // it used to run at random and snap on the last frame, so the row could decelerate
    // onto 2x and then announce 1x
    for (let count = 2; count <= 6; count++) {
      for (let target = 0; target < count; target++) {
        const start = topSlotStart(target, count);
        expect(topSlotAt(start, TOP_SLOT_TICKS, count)).toBe(target);
      }
    }
  });

  it("never points outside the rungs it is allowed to visit", () => {
    const count = 4;
    const start = topSlotStart(2, count);
    for (let step = 0; step <= TOP_SLOT_TICKS; step++) {
      const at = topSlotAt(start, step, count);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(at).toBeLessThan(count);
    }
  });

  it("passes every rung on the way, so the run reads as a spin and not a jump", () => {
    const count = 4;
    const start = topSlotStart(1, count);
    const seen = new Set(
      Array.from({ length: TOP_SLOT_TICKS + 1 }, (_, i) => topSlotAt(start, i, count))
    );
    expect(seen.size).toBe(count);
  });

  it("advances exactly one rung per step", () => {
    const count = 5;
    const start = topSlotStart(3, count);
    for (let step = 1; step <= TOP_SLOT_TICKS; step++) {
      const prev = topSlotAt(start, step - 1, count);
      const now = topSlotAt(start, step, count);
      expect(now).toBe((prev + 1) % count);
    }
  });

  it("copes with a level that has unlocked only the one rung", () => {
    expect(topSlotStart(0, 1)).toBe(0);
    expect(topSlotAt(0, TOP_SLOT_TICKS, 1)).toBe(0);
  });

  it("does not divide by a count of nothing", () => {
    expect(topSlotStart(0, 0)).toBe(0);
    expect(topSlotAt(0, 5, 0)).toBe(0);
  });
});
