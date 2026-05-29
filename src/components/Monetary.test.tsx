import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Monetary from "./Monetary";

describe("Monetary", () => {
  it("formats whole amounts with the KP symbol and no fraction by default", () => {
    const { container } = render(<Monetary value={1234} />);
    const text = container.textContent || "";
    expect(text).toContain("K₽");
    expect(text).toContain("1,234");
    expect(text).not.toContain(".00");
  });

  it("shows fractions when asked", () => {
    const { container } = render(<Monetary value={1234.5} showFraction />);
    expect(container.textContent || "").toContain("1,234.5");
  });
});
