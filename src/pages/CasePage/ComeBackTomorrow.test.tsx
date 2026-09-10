import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ComeBackTomorrow from "./ComeBackTomorrow";
import UserContext from "../../UserContext";
import { GiftStatus } from "../../services/gift/GiftService";

const getGiftStatus = vi.fn();
vi.mock("../../services/gift/GiftService", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getGiftStatus: (...args: unknown[]) => getGiftStatus(...args),
}));

const status = (over: Partial<GiftStatus> = {}): GiftStatus => ({
  canSpin: true,
  nextAt: null,
  streak: 0,
  nextStreak: 1,
  keepsStreak: false,
  ...over,
});

const draw = (show = true, userId: string | null = "u1") =>
  render(
    <UserContext.Provider value={{ userData: userId ? { id: userId } : null } as never}>
      <MemoryRouter>
        <ComeBackTomorrow show={show} />
      </MemoryRouter>
    </UserContext.Provider>
  );

describe("the come back tomorrow card after the first case", () => {
  beforeEach(() => {
    window.localStorage.clear();
    getGiftStatus.mockReset().mockResolvedValue(status());
  });

  it("points at the waiting gift when it can be spun right now", async () => {
    draw();
    expect(await screen.findByText(/daily gift is waiting/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /spin the daily gift/i }).getAttribute("href")).toBe("/gift");
  });

  it("names the day they would reach when today's is already taken", async () => {
    // nextStreak is what the next spin lands on, which after a claim today is tomorrow's
    getGiftStatus.mockResolvedValue(status({ canSpin: false, nextAt: "2026-09-11T06:00:00.000Z", streak: 1, nextStreak: 2 }));
    draw();
    expect(await screen.findByText(/come back tomorrow for day 2/i)).toBeTruthy();
  });

  it("waits for the prize to be on screen", async () => {
    draw(false);
    await waitFor(() => expect(getGiftStatus).toHaveBeenCalled());
    expect(screen.queryByText(/come back tomorrow/i)).toBeNull();
    expect(screen.queryByText(/daily gift is waiting/i)).toBeNull();
  });

  it("shows once per account, on the first case, and never again", async () => {
    const first = draw();
    expect(await screen.findByText(/daily gift is waiting/i)).toBeTruthy();
    first.unmount();

    draw();
    await waitFor(() => expect(getGiftStatus).toHaveBeenCalled());
    expect(screen.queryByText(/daily gift is waiting/i)).toBeNull();
  });

  it("is a different once for a different account", async () => {
    const first = draw();
    expect(await screen.findByText(/daily gift is waiting/i)).toBeTruthy();
    first.unmount();

    draw(true, "u2");
    expect(await screen.findByText(/daily gift is waiting/i)).toBeTruthy();
  });

  it("can be closed", async () => {
    draw();
    fireEvent.click(await screen.findByLabelText("Dismiss"));
    expect(screen.queryByText(/daily gift is waiting/i)).toBeNull();
  });

  it("has nothing to say to somebody who is not signed in", async () => {
    draw(true, null);
    expect(screen.queryByText(/daily gift is waiting/i)).toBeNull();
  });
});
