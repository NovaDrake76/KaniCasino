import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GiftPrompt from "./GiftPrompt";
import UserContext from "../../UserContext";
import { GiftStatus } from "../../services/gift/GiftService";

const getGiftStatus = vi.fn();
vi.mock("../../services/gift/GiftService", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getGiftStatus: (...args: unknown[]) => getGiftStatus(...args),
}));

const status = (over: Partial<GiftStatus> = {}): GiftStatus => ({
  canSpin: true,
  nextAt: "2026-09-01T06:00:00.000Z",
  streak: 3,
  nextStreak: 4,
  keepsStreak: true,
  ...over,
});

const draw = (path = "/crash") =>
  render(
    <UserContext.Provider value={{ userData: { id: "u1" } } as never}>
      <MemoryRouter initialEntries={[path]}>
        <GiftPrompt />
      </MemoryRouter>
    </UserContext.Provider>
  );

describe("the floating daily gift prompt", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getGiftStatus.mockReset().mockResolvedValue(status());
  });

  it("says what the streak would reach, so skipping it has a stated cost", async () => {
    draw();
    expect(await screen.findByText(/Spin it to reach a 4 day streak/)).toBeTruthy();
  });

  it("offers to start one when there is no streak running", async () => {
    getGiftStatus.mockResolvedValue(status({ streak: 0, nextStreak: 1, keepsStreak: false }));
    draw();
    expect(await screen.findByText(/start a streak/)).toBeTruthy();
  });

  it("stays away while the gift is still on cooldown", async () => {
    getGiftStatus.mockResolvedValue(status({ canSpin: false }));
    draw();
    await waitFor(() => expect(getGiftStatus).toHaveBeenCalled());
    expect(screen.queryByText(/daily gift is ready/)).toBeNull();
  });

  it("does not nag on the page that grants it", async () => {
    draw("/gift");
    await waitFor(() => expect(getGiftStatus).toHaveBeenCalled());
    expect(screen.queryByText(/daily gift is ready/)).toBeNull();
  });

  it("stays dismissed for the day, and only for that day", async () => {
    const first = draw();
    fireEvent.click(await screen.findByLabelText("Dismiss"));
    expect(screen.queryByText(/daily gift is ready/)).toBeNull();
    first.unmount();

    // same cooldown: it was already turned down, so it stays away
    const again = draw();
    await waitFor(() => expect(getGiftStatus).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/daily gift is ready/)).toBeNull();
    again.unmount();

    // tomorrow is a different cooldown, and coming back is the whole point of it
    getGiftStatus.mockResolvedValue(status({ nextAt: "2026-09-02T06:00:00.000Z" }));
    draw();
    expect(await screen.findByText(/daily gift is ready/)).toBeTruthy();
  });
});
