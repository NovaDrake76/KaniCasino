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
vi.mock("../../daisu/shop/shopStore", () => ({ loadShop: () => Promise.resolve(null), useShopState: () => null }));

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

  // the strip was the one thing on a game page nobody clicked, so it became something to buy
  it("is a locked strip for an account in her beta without the spyglass, and the feed is not asked for", () => {
    draw({ id: "u1", features: { daisu: true }, unlocks: [] });
    expect(screen.getByText(/live bets need a spyglass/i)).toBeTruthy();
    expect(screen.queryByText(/live bets$/i)).toBeNull();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("shows the feed once the spyglass is held, and always outside her beta", () => {
    const { unmount } = draw({ id: "u1", features: { daisu: true }, unlocks: ["spyglass"] });
    expect(screen.getByText(/^live bets$/i)).toBeTruthy();
    expect(subscribe).toHaveBeenCalledTimes(1);
    unmount();

    draw({ id: "u2", features: {}, unlocks: [] });
    expect(screen.getByText(/^live bets$/i)).toBeTruthy();
    expect(screen.queryByText(/spyglass/i)).toBeNull();
  });
});
