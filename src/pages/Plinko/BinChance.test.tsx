import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BinChance from "./BinChance";
import { BOARD_W } from "./plinkoBoard";

const inBoard = (bin: number) => render(<svg viewBox={`0 0 ${BOARD_W} 900`}><BinChance bin={bin} /></svg>);

describe("the chance tooltip over a plinko bin", () => {
  it("says how likely the ball is to land in that bin", () => {
    inBoard(4);
    expect(screen.getByRole("tooltip").textContent).toContain("2.78%");
  });

  it("stays on the board over the outermost bins", () => {
    for (const bin of [0, 16]) {
      const { unmount } = inBoard(bin);
      const box = screen.getByRole("tooltip").querySelector("rect");
      const x = Number(box?.getAttribute("x"));
      const w = Number(box?.getAttribute("width"));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(BOARD_W);
      unmount();
    }
  });
});
