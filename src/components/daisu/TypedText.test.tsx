import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import TypedText from "./TypedText";

const motion = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }));

describe("TypedText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("types a line out letter by letter, keeping the whole line for screen readers", async () => {
    vi.useFakeTimers();
    motion(false);
    const { container } = render(<TypedText text="Click the jar." />);

    expect(container.querySelector(".sr-only")?.textContent).toBe("Click the jar.");
    expect(container.querySelector("[aria-hidden]")?.textContent).toBe("");

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.textContent).toBe("Click the jar.");
    expect(container.querySelector(".sr-only")).toBeNull();
  });

  it("shows the whole line at once for a player who asked for less motion", () => {
    motion(true);
    const { container } = render(<TypedText text="Click the jar." />);

    expect(container.textContent).toBe("Click the jar.");
  });
});
