import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CashoutCard from "./CashoutCard";

describe("the cash-out card over the mines board", () => {
  it("shows the multiplier cashed at and what it paid", () => {
    render(<CashoutCard multiplier={2.0925} payout={920.69} />);

    const card = screen.getByRole("status");
    expect(card.textContent).toContain("2.09×");
    expect(card.textContent).toContain("920.69");
  });
});
