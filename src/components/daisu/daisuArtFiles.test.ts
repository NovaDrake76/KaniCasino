import { describe, it, expect, vi, afterEach } from "vitest";
import { BUST, IDLE, PART, PARTS, preloadDaisuArt } from "./daisuArtFiles";
import { ART_VERSION } from "./daisuParts";

describe("warming her drawings", () => {
  afterEach(() => vi.restoreAllMocks());

  it("asks for every layer once the page is idle, and only once", () => {
    const asked: string[] = [];
    vi.stubGlobal("Image", class { set src(v: string) { asked.push(v); } });
    const idle = vi.fn((cb: () => void) => cb());
    vi.stubGlobal("requestIdleCallback", idle);

    preloadDaisuArt();
    preloadDaisuArt();

    expect(idle).toHaveBeenCalledTimes(1);
    expect(asked).toEqual(PARTS.map(PART));
    // versioned, so a copy of last release's layer under the same name is never mixed into this drawing
    expect(asked).toContain(`/images/daisu/parts/base.webp?v=${ART_VERSION}`);
    expect(asked).toHaveLength(14);
  });
});

describe("her flat drawings", () => {
  // the same names as the sketch's, so they carry the version the layers do
  it("ask for this drawing, never a cached older one", () => {
    expect(BUST).toBe(`/images/daisu/bust.webp?v=${ART_VERSION}`);
    expect(IDLE).toBe(`/images/daisu/idle.webp?v=${ART_VERSION}`);
  });
});
