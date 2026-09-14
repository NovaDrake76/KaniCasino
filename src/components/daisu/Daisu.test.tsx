import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DaisuDock from "./index";
import UserContext from "../../UserContext";
import { GAME_PLAYED_EVENT } from "../../services/api";
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
  visitMission: vi.fn(),
}));

vi.mock("../../services/cases/CaseServices", () => ({
  getCases: () => Promise.resolve([]),
}));

let giftReady = false;
vi.mock("../../services/gift/GiftService", () => ({
  GIFT_CLAIMED_EVENT: "gift-claimed",
  getGiftStatus: () => Promise.resolve({ canSpin: giftReady, nextAt: null, streak: 0, nextStreak: 1, keepsStreak: false }),
}));

const CYCLE = 8 * 60000;
const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

// a pot that will be full this far from now
const status = (fullInMs: number, over: Partial<PotStatus> = {}): PotStatus => ({
  fill: 1 - fullInMs / CYCLE,
  full: 1000,
  amount: 0,
  fullAt: new Date(Date.now() + fullInMs).toISOString(),
  cycleMs: CYCLE,
  clickRate: 0.8,
  fullBonus: 0.25,
  creditShare: 0.1,
  pick: "dice",
  nextPick: "plinko",
  pickProgress: 0.2,
  creditTtlMs: CYCLE,
  bonuses: [],
  ...over,
});

const claimed = (amount: number, walletBalance: number) => ({
  amount,
  credit: amount / 10,
  pick: "dice",
  fill: 1,
  pickChanged: false,
  walletBalance,
  nextBonus: new Date(Date.now() + CYCLE).toISOString(),
  status: status(CYCLE, { bonuses: [{ game: "dice", amount: amount / 10, expiresAt: iso(CYCLE), expired: false }] }),
});

const toogleUserData = vi.fn();

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

const jar = () => screen.getByLabelText("The jar");
// the jar ticks on Date.now, so fake timers move the pot and the pause together
const wait = (ms: number) =>
  act(async () => {
    vi.advanceTimersByTime(ms);
  });
const runState = () => document.querySelector("[data-run]")?.getAttribute("data-run");
const runAmount = () => Number((document.querySelector("[data-run]")?.textContent || "").replace(/\D/g, ""));

describe("daisu in the corner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("kani.daisuStage", "popup");
    giftReady = false;
    toogleUserData.mockReset();
    getMissions.mockReset().mockResolvedValue({ missions: [], totals: {} });
    claimPot.mockReset();
    getPotStatus.mockReset().mockResolvedValue(status(0));
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (document as { visibilityState?: string }).visibilityState;
  });

  it("is not there for an account outside the beta", async () => {
    draw(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByLabelText("Daisu")).toBeNull();
    expect(getPotStatus).not.toHaveBeenCalled();
  });

  it("shows a full jar with the full-pot bonus on it", async () => {
    draw();
    expect(await screen.findByText(/full pot bonus \+25%/i)).toBeTruthy();
  });

  it("counts a run of clicks under the jar and sends it once they pause for four seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getPotStatus.mockResolvedValue(status(60000));
    claimPot.mockResolvedValue(claimed(900, 1000));
    draw();
    await screen.findByText(/full in \d/i);

    fireEvent.click(jar());
    await wait(3000);
    fireEvent.click(jar());
    await wait(3000);
    expect(claimPot).not.toHaveBeenCalled();
    expect(runState()).toBe("open");

    await wait(1100);
    await waitFor(() => expect(claimPot).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(runState()).toBe("sent"));
    expect(toogleUserData.mock.calls[0][0].walletBalance).toBe(1000);
    expect(await screen.findByText(/used first on your dice bets/i)).toBeTruthy();
  });

  it("pours what refilled during the pause into the run as it sends, so the total is the take", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getPotStatus.mockResolvedValue(status(60000));
    claimPot.mockReturnValue(new Promise(() => undefined));
    draw();
    await screen.findByText(/full in \d/i);

    fireEvent.click(jar());
    const clicked = runAmount();
    await wait(4100);

    await waitFor(() => expect(runState()).toBe("sending"));
    expect(claimPot).toHaveBeenCalledTimes(1);
    expect(runAmount()).toBeGreaterThan(clicked);
  });

  it("turns the run red when the take fails, says so, and re-reads the pot", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    claimPot.mockRejectedValue({ response: { status: 500, data: { message: "Server error" } } });
    draw();
    await screen.findByText(/full pot bonus/i);

    fireEvent.click(jar());
    await wait(4100);

    await waitFor(() => expect(runState()).toBe("failed"));
    expect(await screen.findByText(/still in the jar|nothing's gone/i)).toBeTruthy();
    expect(getPotStatus).toHaveBeenCalledTimes(2);
    expect(toogleUserData).not.toHaveBeenCalled();
  });

  it("sends a waiting run at once when the tab is hidden", async () => {
    claimPot.mockResolvedValue(claimed(1000, 1100));
    draw();
    await screen.findByText(/full pot bonus/i);

    fireEvent.click(jar());
    expect(claimPot).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    fireEvent(document, new Event("visibilitychange"));

    await waitFor(() => expect(claimPot).toHaveBeenCalledTimes(1));
  });

  it("finds an empty jar right after a take and complains without calling home", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getPotStatus.mockResolvedValue(status(CYCLE));
    draw();
    await screen.findByText(/full in [78]:\d\d/i);
    fireEvent.click(jar());

    expect(await screen.findByText(/learn to count|clicking for fun|greedy/i)).toBeTruthy();
    await wait(4100);
    expect(claimPot).not.toHaveBeenCalled();
    expect(runState()).toBeUndefined();
  });

  it("shows the bonus on her pick with its clock, and hurries you in its last minute", async () => {
    getPotStatus.mockResolvedValue(
      status(CYCLE, {
        bonuses: [
          { game: "plinko", amount: 125, expiresAt: iso(45000), expired: false },
          { game: "dice", amount: 12.5, expiresAt: iso(-1000), expired: true },
        ],
      })
    );
    draw();

    expect(await screen.findByText(/play before it runs out/i)).toBeTruthy();
    expect(screen.getAllByText(/0:4\d/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/dice bonus expired/i)).toBeNull();
  });

  it("keeps the last bonus as a receipt once every one has run out", async () => {
    getPotStatus.mockResolvedValue(status(CYCLE, { bonuses: [{ game: "plinko", amount: 125, expiresAt: iso(-60000), expired: true }] }));
    draw();

    expect(await screen.findByText(/plinko bonus expired/i)).toBeTruthy();
    expect(screen.getByText(/take from the jar for a new one/i)).toBeTruthy();
  });

  it("calls a bonus out as it runs out while she is open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getPotStatus.mockResolvedValue(status(CYCLE, { bonuses: [{ game: "dice", amount: 85, expiresAt: iso(3000), expired: false }] }));
    draw();
    await screen.findByText(/play before it runs out/i);

    await wait(3500);

    expect(await screen.findByText(/took your dice bonus back|on dice is mine now/i)).toBeTruthy();
    expect(await screen.findByText(/dice bonus expired/i)).toBeTruthy();
  });

  it("reads the pot again after its bonus game is played, and not after any other", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getPotStatus.mockResolvedValue(status(CYCLE, { bonuses: [{ game: "dice", amount: 85, expiresAt: iso(200000), expired: false }] }));
    draw();
    await screen.findByText(/used first on your dice bets/i);
    const played = (game: string) =>
      act(() => {
        window.dispatchEvent(new CustomEvent(GAME_PLAYED_EVENT, { detail: { game } }));
      });

    played("plinko");
    await wait(3500);
    expect(getPotStatus).toHaveBeenCalledTimes(1);

    played("dice");
    played("dice");
    await wait(3500);
    await waitFor(() => expect(getPotStatus).toHaveBeenCalledTimes(2));
  });

  it("shows the bonus clock on the folded bubble", async () => {
    window.localStorage.setItem("kani.daisuStage", "bubble");
    getPotStatus.mockResolvedValue(status(CYCLE, { bonuses: [{ game: "dice", amount: 85, expiresAt: iso(200000), expired: false }] }));
    draw();

    expect(await screen.findByText(/dice bonus, 3:\d\d/i)).toBeTruthy();
  });

  it("talks back when she is poked", async () => {
    draw();
    await screen.findByText(/full pot bonus/i);
    fireEvent.click(screen.getByLabelText("Daisu", { selector: "button" }));

    expect(await screen.findByText(/^What\?$|I'm busy|poking me|not the pot/)).toBeTruthy();
  });

  it("offers her gift when one is waiting", async () => {
    giftReady = true;
    draw();
    expect(await screen.findByText(/daisu has a gift for you/i)).toBeTruthy();
  });

  it("opens her room with the missions described, and comes back", async () => {
    getMissions.mockResolvedValue({
      missions: [
        { key: "cases-10", title: "Case cracker", description: "Open 10 cases.", category: "games", reward: 1500, social: null, target: 10, current: 7, complete: false, claimed: false, claimable: false },
      ],
      totals: {},
    });
    draw();
    fireEvent.click(await screen.findByText(/visit daisu's room/i));

    expect(await screen.findByRole("dialog", { name: /daisu's room/i })).toBeTruthy();
    expect(await screen.findByText("Case cracker")).toBeTruthy();
    expect(screen.getByText("Open 10 cases.")).toBeTruthy();

    fireEvent.click(screen.getByText(/pot boosts/i));
    expect(screen.getByText(/nothing here yet/i)).toBeTruthy();

    fireEvent.click(screen.getByText(/back to daisu/i));
    expect(await screen.findByLabelText("Daisu", { selector: "section" })).toBeTruthy();
  });

  it("folds into the bubble and remembers that", async () => {
    draw();
    fireEvent.click(await screen.findByLabelText("Close"));

    expect(await screen.findByLabelText("Open Daisu")).toBeTruthy();
    expect(window.localStorage.getItem("kani.daisuStage")).toBe("bubble");
  });
});
