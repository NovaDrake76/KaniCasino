import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import LiveBetsView from "./LiveBets.view";
import { LiveBet } from "../../../services/liveFeed/LiveFeedService";

const row = (over: Partial<LiveBet> = {}): LiveBet => ({
  id: "r1",
  at: Date.now(),
  game: "dice",
  _id: "u123",
  username: "player-one",
  profilePicture: "",
  level: 10,
  badge: null,
  bet: 100,
  payout: 250,
  multiplier: 2.5,
  ...over,
});

const draw = (rows: LiveBet[]) =>
  render(
    <MemoryRouter>
      <LiveBetsView rows={rows} />
    </MemoryRouter>
  );

describe("the live bet ticker", () => {
  it("links a row to the player's profile", () => {
    // the row is handed to Player, which links on _id. it carried userId, so every row
    // in the table pointed at /profile/undefined.
    draw([row()]);

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/profile/u123");
    expect(link.getAttribute("href")).not.toContain("undefined");
  });

  it("shows a win as its payout and a loss as the stake going the other way", () => {
    const { container } = draw([
      row({ id: "w", payout: 250 }),
      row({ id: "l", payout: 0, multiplier: 0 }),
    ]);

    const payouts = [...container.querySelectorAll("tbody tr")].map(
      (tr) => tr.lastElementChild?.textContent?.replace(/\s/g, "") ?? ""
    );
    expect(payouts[0]).toMatch(/^K₽250$/);
    expect(payouts[1]).toMatch(/^-K₽100$/);
  });

  it("says so when nothing has been bet lately", () => {
    draw([]);
    expect(screen.getByText(/no bets|nenhuma aposta/i)).toBeTruthy();
  });
});
