import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Drum from "./index";
import { MAX_FRAME_S, frameSeconds } from "./Drum.services";

const ALL = Array.from({ length: 20 }, (_, i) => i + 1);

// a 2d context that records what was drawn; jsdom has none of its own
const fakeContext = () => {
  const calls: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) => {
      if (key in target) return target[key];
      if (key === "createRadialGradient" || key === "createLinearGradient") return () => gradient;
      return (...args: unknown[]) => calls.push(`${key}:${args.length}`);
    },
    set: (target, key: string, value) => {
      target[key] = value;
      return true;
    },
  });
  return { ctx, calls };
};

let seen: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
const disconnect = vi.fn();
class FakeObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    seen = callback;
  }
  observe() {
    return undefined;
  }
  disconnect() {
    disconnect();
  }
}

let frames: FrameRequestCallback[] = [];
const requestFrame = vi.fn((fn: FrameRequestCallback) => {
  frames.push(fn);
  return frames.length;
});
const cancelFrame = vi.fn();
let visibility: DocumentVisibilityState = "visible";
let painted: ReturnType<typeof fakeContext>;

const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

const onScreen = (yes: boolean) => act(() => seen?.([{ isIntersecting: yes }]));

describe("the drum", () => {
  beforeEach(() => {
    seen = null;
    frames = [];
    visibility = "visible";
    vi.clearAllMocks();
    painted = fakeContext();
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => painted.ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "clientWidth", "get").mockReturnValue(200);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is an image with a label, painted once even before it animates", () => {
    render(<Drum numbers={ALL} speed="open" label="Lottery drum" />);
    expect(screen.getByRole("img", { name: "Lottery drum" }).tagName).toBe("CANVAS");
    expect(painted.calls.filter((c) => c.startsWith("fillText"))).toHaveLength(20);
  });

  it("sizes its backing store for the screen's pixel ratio, no finer than twice", () => {
    vi.stubGlobal("devicePixelRatio", 3);
    render(<Drum numbers={ALL} speed="open" label="Lottery drum" />);
    const canvas = screen.getByTestId("drum") as HTMLCanvasElement;
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(400);
  });

  it("only runs its loop while it is on screen in a visible tab", () => {
    render(<Drum numbers={ALL} speed="open" label="Lottery drum" />);
    expect(requestFrame).not.toHaveBeenCalled();
    onScreen(true);
    expect(requestFrame).toHaveBeenCalledTimes(1);

    act(() => frames[0](1000));
    act(() => frames[1](1016));
    expect(requestFrame).toHaveBeenCalledTimes(3);

    setVisibility("hidden");
    expect(cancelFrame).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    expect(requestFrame).toHaveBeenCalledTimes(4);

    onScreen(false);
    expect(cancelFrame).toHaveBeenCalledTimes(2);
    setVisibility("visible");
    expect(requestFrame).toHaveBeenCalledTimes(4);
  });

  it("stops and lets go of everything when it goes away", () => {
    const removed = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<Drum numbers={ALL} speed="drawing" label="Lottery drum" />);
    onScreen(true);
    unmount();
    expect(cancelFrame).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    expect(removed).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  });

  it("holds still for a player who asked for less motion, and redraws when a ball leaves", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query }));
    const { rerender } = render(<Drum numbers={ALL} speed="drawing" label="Lottery drum" />);
    onScreen(true);
    expect(requestFrame).not.toHaveBeenCalled();
    painted.calls.length = 0;
    rerender(<Drum numbers={ALL.filter((n) => n !== 7)} speed="drawing" label="Lottery drum" />);
    expect(painted.calls.filter((c) => c.startsWith("fillText"))).toHaveLength(19);
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it("never steps a frame further than the clamp, however long the tab was away", () => {
    expect(frameSeconds(0, 5000)).toBe(0);
    expect(frameSeconds(1000, 1016)).toBeCloseTo(0.016);
    expect(frameSeconds(1000, 3_600_000)).toBe(MAX_FRAME_S);
    expect(frameSeconds(2000, 1000)).toBe(0);
  });
});
