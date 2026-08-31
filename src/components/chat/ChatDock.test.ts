import { describe, it, expect } from "vitest";
import { RAIL_WIDTH, shiftFor } from "./ChatDock";

describe("whether the rail has to push the page across", () => {
  it("leaves a centred board where it is when its own margin already fits the rail", () => {
    // crash on a 1920 window leaves 360px either side, which is more than the rail needs.
    // it used to be shoved across anyway, for nothing.
    expect(shiftFor(1920, 1200)).toBe(0);
    expect(shiftFor(1600, 1000)).toBe(0);
  });

  it("pushes when the margin is too tight to hold the rail", () => {
    expect(shiftFor(1400, 1200)).toBe(RAIL_WIDTH);
    expect(shiftFor(1600, 1200)).toBe(RAIL_WIDTH);
  });

  it("pushes a full bleed page, which has no margin at all", () => {
    expect(shiftFor(1920, 1920)).toBe(RAIL_WIDTH);
  });

  it("pushes the whole width rather than the shortfall", () => {
    // half a rail of padding would leave the content sitting under the rail
    expect(shiftFor(1500, 1200)).toBe(RAIL_WIDTH);
  });

  it("settles rather than oscillating once the push lands", () => {
    // the pushed page is narrower, so the rule is asked again with a smaller content
    // width; it has to reach the same answer or the layout would flicker every frame
    for (const viewport of [1300, 1400, 1500, 1600, 1700, 1800, 1920, 2560]) {
      const natural = Math.min(1200, viewport);
      const first = shiftFor(viewport, natural);
      const settled = Math.min(1200, viewport - first);
      expect(shiftFor(viewport, settled)).toBe(first);
    }
  });

  it("pushes when it cannot measure the page yet, so nothing is ever covered", () => {
    expect(shiftFor(1920, 0)).toBe(RAIL_WIDTH);
  });
});
