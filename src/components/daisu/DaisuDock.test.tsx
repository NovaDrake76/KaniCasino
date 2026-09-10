import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DaisuDock from "./index";
import UserContext from "../../UserContext";
import type { PotStatus } from "../../services/daisu/DaisuService";

const getPotStatus = vi.fn();
const claimPot = vi.fn();
vi.mock("../../services/daisu/DaisuService", () => ({
  getPotStatus: (...args: unknown[]) => getPotStatus(...args),
  claimPot: (...args: unknown[]) => claimPot(...args),
}));

const getMissions = vi.fn();
vi.mock("../../services/missions/MissionService", () => ({
  getMissions: (...args: unknown[]) => getMissions(...args),
  claimMission: vi.fn(),
}));

vi.mock("../../services/gift/GiftService", () => ({
  GIFT_CLAIMED_EVENT: "gift-claimed",
  getGiftStatus: () => Promise.resolve({ canSpin: false, nextAt: null, streak: 0, nextStreak: 1, keepsStreak: false }),
}));

const CYCLE = 8 * 60000;

// a pot that will be full this far from now
const status = (fullInMs: number, over: Partial<PotStatus> = {}): PotStatus => ({
  fill: 1 - fullInMs / CYCLE,
  full: 500,
  amount: 0,
  fullAt: new Date(Date.now() + fullInMs).toISOString(),
  floor: 0.1,
  cycleMs: CYCLE,
  creditShare: 0.1,
  pick: "dice",
  credits: {},
  ...over,
});

const toogleUserData = vi.fn();

// the wallet format puts a non-breaking space after the sign in some runtimes
const money = (n: string) => new RegExp("K₽[\\s\\u00a0]?" + n);

const draw = (daisu = true) =>
  render(
    <UserContext.Provider
      value={{ userData: { id: "u1", walletBalance: 100, features: { daisu } }, toogleUserData } as never}
    >
      <MemoryRouter>
        <DaisuDock />
      </MemoryRouter>
    </UserContext.Provider>
  );

describe("the pot in the corner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    toogleUserData.mockReset();
    getMissions.mockReset().mockResolvedValue({ missions: [], totals: {} });
    claimPot.mockReset();
    getPotStatus.mockReset().mockResolvedValue(status(0));
  });

  it("is not there for an account outside the beta", async () => {
    draw(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByLabelText("Daisu")).toBeNull();
    expect(getPotStatus).not.toHaveBeenCalled();
  });

  it("offers the whole pot when it is full", async () => {
    draw();
    expect(await screen.findByText("Take it all")).toBeTruthy();
    expect(screen.getAllByText(money("500")).length).toBeGreaterThan(0);
  });

  it("offers a part of it while it is filling", async () => {
    getPotStatus.mockResolvedValue(status(CYCLE / 2));
    draw();
    expect(await screen.findByText("Take")).toBeTruthy();
    expect(screen.getAllByText(money("231")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/full in 4:00/i).length).toBeGreaterThan(0);
  });

  it("pays out, moves the wallet and thanks you", async () => {
    claimPot.mockResolvedValue({
      amount: 500,
      credit: 50,
      pick: "dice",
      fill: 1,
      walletBalance: 600,
      nextBonus: new Date(Date.now() + CYCLE).toISOString(),
      status: status(CYCLE, { credits: { dice: 50 } }),
    });
    draw();
    fireEvent.click(await screen.findByText("Take it all"));

    await waitFor(() => expect(toogleUserData).toHaveBeenCalled());
    expect(toogleUserData.mock.calls[0][0].walletBalance).toBe(600);
    expect(await screen.findByText(/only on dice/i)).toBeTruthy();
    expect(screen.getAllByText(/Dice/).length).toBeGreaterThan(0);
  });

  it("finds nothing in an empty pot and says so, without calling home", async () => {
    getPotStatus.mockResolvedValue(status(CYCLE));
    draw();
    fireEvent.click(await screen.findByText(/nothing yet/i));

    expect(await screen.findByText(/nothing in here|took it all|checked twice/i)).toBeTruthy();
    expect(claimPot).not.toHaveBeenCalled();
  });

  it("asks about the mission closest to done and shows what it pays", async () => {
    getMissions.mockResolvedValue({
      missions: [
        { key: "cases-10", title: "Case cracker", description: "", category: "games", reward: 1500, social: null, target: 10, current: 7, complete: false, claimed: false, claimable: false },
        { key: "first-case", title: "Crack one open", description: "", category: "onboarding", reward: 250, social: null, target: 1, current: 1, complete: true, claimed: true, claimable: false },
      ],
      totals: {},
    });
    draw();
    expect(await screen.findByText("Case cracker")).toBeTruthy();
    expect(screen.queryByText("Crack one open")).toBeNull();
    expect(screen.getByText(money("1,500"))).toBeTruthy();
  });

  it("folds into a bubble and remembers that", async () => {
    draw();
    fireEvent.click(await screen.findByLabelText("Close"));

    expect(await screen.findByLabelText("Open Daisu")).toBeTruthy();
    expect(window.localStorage.getItem("kani.daisuOpen")).toBe("0");
  });
});
