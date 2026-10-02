import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BinChance from "./BinChance";

describe("the chance chip under a plinko box", () => {
  it("says how likely the ball is to land in that box, just under it", () => {
    render(<BinChance bin={4} x={200} y={500} width={680} />);
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toBe("2.78%");
    expect(tip.style.left).toBe("200px");
    expect(parseFloat(tip.style.top)).toBeGreaterThan(500);
  });

  it("stays inside the board over the outermost boxes", () => {
    const { unmount } = render(<BinChance bin={0} x={10} y={500} width={360} />);
    expect(parseFloat(screen.getByRole("tooltip").style.left)).toBeGreaterThan(10);
    unmount();
    render(<BinChance bin={16} x={352} y={500} width={360} />);
    expect(parseFloat(screen.getByRole("tooltip").style.left)).toBeLessThan(352);
  });
});
