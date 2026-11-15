import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import ScratchCoating from "./index";
import { SPOT_BRUSH, SPOT_CLEAR, TICKET_CLEAR, ZONE_BRUSH } from "../scratchSurface";

// jsdom has no 2d canvas: every canvas gets a context that records what was drawn on it
const contexts = new Map<HTMLCanvasElement, Record<string, ReturnType<typeof vi.fn>>>();
const contextOf = (canvas: HTMLCanvasElement) => {
  const known = contexts.get(canvas);
  if (known) return known;
  const calls: Record<string, ReturnType<typeof vi.fn>> = {};
  const gradient = () => ({ addColorStop: () => undefined });
  const ctx = new Proxy(calls, {
    get: (target, prop: string) => {
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return gradient;
      if (!target[prop]) target[prop] = vi.fn();
      return target[prop];
    },
    set: () => true,
  });
  contexts.set(canvas, ctx);
  return ctx;
};

// a 100 by 100 coating, so a pointer at (50, 50) is the middle of it
const SIDE = 100;
const pointer = (type: string, canvas: HTMLCanvasElement, x: number, y: number) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, "pointerId", { value: 1 });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  act(() => {
    canvas.dispatchEvent(event);
  });
};
// one press: down at the first point, a move to every other, then up (or left held)
const press = (canvas: HTMLCanvasElement, path: [number, number][], lift = true) => {
  pointer("pointerdown", canvas, ...path[0]);
  for (const p of path.slice(1)) pointer("pointermove", canvas, ...p);
  if (lift) pointer("pointerup", canvas, ...path[path.length - 1]);
};
const line = (from: [number, number], to: [number, number], moves = 10): [number, number][] =>
  Array.from({ length: moves + 1 }, (_, k) => [from[0] + ((to[0] - from[0]) * k) / moves, from[1] + ((to[1] - from[1]) * k) / moves]);
const across = line([2, 50], [98, 50]);
const back = line([98, 50], [2, 50]);
// back and forth over rows that drift down the spot, the way a hand rubs
const rubbing = (strokes: number): [number, number][] =>
  Array.from({ length: strokes }, (_, k) => {
    const y = 50 + 30 * Math.sin(k * 0.9);
    return k % 2 ? line([98, y], [2, y]) : line([2, y], [98, y]);
  }).flat();

const spot = (props: Partial<React.ComponentProps<typeof ScratchCoating>> = {}) => {
  const onStart = vi.fn(() => true);
  const onComplete = vi.fn();
  const all = { label: "", testId: "spot", active: true, state: "covered" as const, brush: SPOT_BRUSH, threshold: SPOT_CLEAR, onStart, onRub: () => undefined, onComplete, ...props };
  const view = render(<ScratchCoating {...all} />);
  const canvas = screen.getByTestId(all.testId) as HTMLCanvasElement;
  return { canvas, onStart, onComplete, ctx: () => contextOf(canvas), rerender: (next: Partial<typeof all>) => view.rerender(<ScratchCoating {...all} {...next} />) };
};

describe("a treasure spot's coating", () => {
  beforeEach(() => {
    contexts.clear();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      return contextOf(this) as never;
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: SIDE, height: SIDE } as DOMRect);
    // reduced motion puts the foil back in one go instead of over a few frames
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("is not spent by a tap", () => {
    const { canvas, onStart } = spot();
    press(canvas, [[50, 50], [50, 50]]);
    press(canvas, [[50, 50], [51, 50]]);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("is not spent by a short swipe or by one swipe straight across", () => {
    const { canvas, onStart } = spot();
    press(canvas, line([50, 50], [80, 50], 5));
    press(canvas, line([50, 20], [50, 140], 12));
    press(canvas, across);
    press(canvas, line([0, 0], [100, 100]));
    expect(onStart).not.toHaveBeenCalled();
  });

  it("puts the foil back whole when the press lifts early, and forgets what it wore", () => {
    const { canvas, onStart, ctx } = spot();
    press(canvas, across);
    expect(ctx().drawImage).toHaveBeenCalled();
    expect(ctx().clearRect).toHaveBeenCalledTimes(1);
    // the same two strokes in one press would commit; split over two presses they never add up
    press(canvas, back);
    expect(ctx().clearRect).toHaveBeenCalledTimes(2);
    expect(onStart).not.toHaveBeenCalled();
    press(canvas, [...across, ...back.slice(1)], false);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("is spent exactly once by sustained rubbing, keeps its wear after that, and clears", () => {
    const { canvas, onStart, onComplete, ctx } = spot();
    press(canvas, rubbing(3));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    // committed: a lift no longer puts the foil back, and the next press carries on from here
    expect(ctx().clearRect).not.toHaveBeenCalled();
    for (let pass = 0; pass < 2; pass++) for (let y = 6; y < SIDE; y += 12) press(canvas, line([2, y], [98, y]));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("puts the foil back when it is refused, or when the last pick goes to another spot mid-rub", () => {
    const refused = spot({ onStart: vi.fn(() => false), testId: "refused" });
    press(refused.canvas, rubbing(3), false);
    expect(refused.ctx().clearRect).toHaveBeenCalledTimes(1);
    expect(refused.onComplete).not.toHaveBeenCalled();

    const other = spot({ testId: "other" });
    press(other.canvas, across, false);
    act(() => other.rerender({ active: false }));
    expect(other.ctx().clearRect).toHaveBeenCalledTimes(1);
    press(other.canvas, rubbing(6));
    expect(other.onStart).not.toHaveBeenCalled();
  });

  it("leaves a stack ticket's coating as it was: every stroke counts, across presses", () => {
    const { canvas, ctx, onComplete } = spot({ onStart: undefined, brush: ZONE_BRUSH, threshold: TICKET_CLEAR, testId: "zone" });
    press(canvas, across);
    expect(ctx().clearRect).not.toHaveBeenCalled();
    for (let y = 4; y < SIDE; y += 11) press(canvas, line([2, y], [98, y]));
    for (let y = 4; y < SIDE; y += 11) press(canvas, line([2, y], [98, y]));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
