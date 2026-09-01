import { describe, it, expect } from "vitest";
import { RAIL_WIDTH, closesOnResize, shiftFor, shouldDock } from "./ChatDock";

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

describe("whether the rail is docked", () => {
  it("needs both the room and the request", () => {
    expect(shouldDock(true, "1")).toBe(true);
    expect(shouldDock(false, "1")).toBe(false);
    expect(shouldDock(true, "0")).toBe(false);
    expect(shouldDock(true, null)).toBe(false);
  });

  it("comes back when the window is widened again", () => {
    // it used to latch: one resize under the width closed it and nothing reopened it, so
    // dragging a window edge in and out again lost the rail until a reload. every viewport
    // change a test makes did the same thing, which is how CI found it.
    const stored = "1";
    expect(shouldDock(true, stored)).toBe(true);
    expect(shouldDock(false, stored)).toBe(false);
    expect(shouldDock(true, stored)).toBe(true);
  });

  it("stays shut through a resize when it was never asked for", () => {
    expect(shouldDock(true, "0")).toBe(false);
    expect(shouldDock(false, "0")).toBe(false);
    expect(shouldDock(true, "0")).toBe(false);
  });
});

describe("remembering the choice", () => {
  it("reads a closed chat back as closed", () => {
    // closing went through a setter that skipped the write, so a chat closed on purpose
    // came straight back on the next reload
    expect(shouldDock(true, "0")).toBe(false);
  });

  it("reads an opened chat back as open", () => {
    expect(shouldDock(true, "1")).toBe(true);
  });

  it("starts closed for somebody who has never touched it", () => {
    expect(shouldDock(true, null)).toBe(false);
  });
});

describe("which resizes close the chat", () => {
  it("closes a rail that has just stopped fitting, so it does not become a modal", () => {
    expect(closesOnResize(true, false)).toBe(true);
  });

  it("leaves a phone alone, whatever its viewport does", () => {
    // the reported bug: the soft keyboard shrinks the viewport, which arrives as a resize.
    // asking "is it narrow now" is true on a phone the whole time, so tapping the box to
    // type closed the panel under the player. so did the url bar collapsing on a scroll.
    expect(closesOnResize(false, false)).toBe(false);
  });

  it("does not close on the way back to a wide window", () => {
    expect(closesOnResize(false, true)).toBe(false);
    expect(closesOnResize(true, true)).toBe(false);
  });
});
