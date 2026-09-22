import { describe, it, expect, vi, afterEach } from "vitest";
import { PART, PARTS, preloadDaisuArt } from "./daisuArtFiles";

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
    expect(asked).toContain("/images/daisu/parts/base.webp");
    expect(asked).toHaveLength(12);
  });
});
