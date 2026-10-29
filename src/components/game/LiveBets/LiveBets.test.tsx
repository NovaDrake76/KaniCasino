import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserContext from "../../../UserContext";
import LiveBets from "./index";

const subscribe = vi.fn();
vi.mock("../../../services/liveFeed/LiveFeedService", () => ({
  subscribeToLiveBets: (...args: unknown[]) => {
    subscribe(...args);
    return () => undefined;
  },
}));

const draw = (userData: object) =>
  render(
    <UserContext.Provider value={{ userData } as never}>
      <MemoryRouter>
        <LiveBets />
      </MemoryRouter>
    </UserContext.Provider>
  );

describe("the live bets under a game", () => {
  beforeEach(() => subscribe.mockReset());

  // the spyglass moved to the live stats, so the feed is open to every account again
  it("shows the feed to an account in her beta without the spyglass", () => {
    draw({ id: "u1", features: { daisu: true }, unlocks: [] });
    expect(screen.getByText(/no bets in the last/i)).toBeTruthy();
    expect(screen.queryByText(/spyglass/i)).toBeNull();
    expect(subscribe).toHaveBeenCalledTimes(1);
  });
});
