import { describe, it, expect } from "vitest";
import { BALL_R, CENTER, RADIUS, DrumState, createDrum, refill, removeBall, settle, step, syncDrum } from "./drumPhysics";

const SPINS = [0.7, 2.6, 3.4];
const ROOM = RADIUS - BALL_R;
const numbersOf = (s: DrumState) => s.balls.map((b) => b.n);

const furthestOut = (s: DrumState) => Math.max(...s.balls.map((b) => Math.hypot(b.x - CENTER, b.y - CENTER)));

const deepestOverlap = (s: DrumState) => {
  let worst = 0;
  for (let i = 0; i < s.balls.length; i++)
    for (let j = i + 1; j < s.balls.length; j++) {
      const a = s.balls[i];
      const b = s.balls[j];
      worst = Math.max(worst, 2 * BALL_R - Math.hypot(a.x - b.x, a.y - b.y));
    }
  return worst;
};

const finite = (s: DrumState) => s.balls.every((b) => [b.x, b.y, b.vx, b.vy, b.rot].every(Number.isFinite)) && Number.isFinite(s.angle);

describe("the drum's physics", () => {
  it("starts with the twenty balls, one of each number", () => {
    expect(numbersOf(createDrum())).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  for (const spin of SPINS) {
    it(`keeps every ball inside the glass and every number finite at ${spin} rad/s`, () => {
      const s = createDrum();
      for (let k = 0; k < 2400; k++) {
        step(s, 1 / 60, spin);
        expect(furthestOut(s)).toBeLessThanOrEqual(ROOM + 1e-6);
      }
      expect(finite(s)).toBe(true);
      expect(s.balls).toHaveLength(20);
    });

    it(`leaves no two balls sunk into each other once it stops after ${spin} rad/s`, () => {
      const s = createDrum();
      step(s, 20, spin);
      settle(s);
      expect(deepestOverlap(s)).toBeLessThan(2);
      expect(Math.min(...s.balls.map((b) => b.y))).toBeGreaterThan(CENTER - RADIUS / 2);
    });
  }

  it("survives a long stall and a nonsense dt without going wild", () => {
    const s = createDrum();
    step(s, 5, 3.4);
    step(s, Number.NaN, 3.4);
    step(s, -1, 3.4);
    step(s, Number.POSITIVE_INFINITY, 3.4);
    expect(finite(s)).toBe(true);
    expect(furthestOut(s)).toBeLessThanOrEqual(ROOM + 1e-6);
  });

  it("takes out exactly the ball it is asked for", () => {
    const s = settle(createDrum());
    removeBall(s, 7);
    expect(numbersOf(s)).toHaveLength(19);
    expect(numbersOf(s)).not.toContain(7);
    removeBall(s, 7);
    expect(numbersOf(s)).toHaveLength(19);
    step(s, 2, 3.4);
    expect(finite(s)).toBe(true);
  });

  it("refills to all twenty, leaving the balls still inside where they were", () => {
    const s = settle(createDrum());
    for (const n of [2, 9, 14]) removeBall(s, n);
    const before = s.balls.find((b) => b.n === 1);
    const at = before && { x: before.x, y: before.y };
    refill(s);
    expect(numbersOf(s)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    const after = s.balls.find((b) => b.n === 1);
    expect(after && { x: after.x, y: after.y }).toEqual(at);
    step(s, 3, 0.7);
    settle(s);
    expect(deepestOverlap(s)).toBeLessThan(2);
  });

  it("brings the drum to a given set of numbers either way", () => {
    const s = createDrum();
    syncDrum(s, [1, 2, 3, 4]);
    expect(numbersOf(s)).toEqual([1, 2, 3, 4]);
    syncDrum(s, [1, 2, 3, 4, 5, 6]);
    expect(numbersOf(s)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("moves two drums built alike exactly alike", () => {
    const a = createDrum();
    const b = createDrum();
    for (const [dt, spin] of [[0.5, 0.7], [1, 2.6], [0.75, 3.4]]) {
      step(a, dt, spin);
      step(b, dt, spin);
    }
    removeBall(a, 5);
    removeBall(b, 5);
    step(a, 1, 3.4);
    step(b, 1, 3.4);
    expect(a).toEqual(b);
    expect(a.angle).not.toBe(0);
  });
});
