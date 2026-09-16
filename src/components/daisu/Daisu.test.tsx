import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import DaisuDock from "./index";
import UserContext from "../../UserContext";
import { GAME_PLAYED_EVENT } from "../../services/api";
import type { PotStatus } from "../../services/daisu/DaisuService";
import { endHelp, helpState } from "./tour/helpStore";
import { DAISU_POKED_EVENT, openDaisuShop } from "./tour/tourEvents";
import { endTour, setPokeMode, syncTour } from "./tour/tourStore";

const getPotStatus = vi.fn();
const claimPot = vi.fn();
vi.mock("../../services/daisu/DaisuService", () => ({
  getPotStatus: (...args: unknown[]) => getPotStatus(...args),
  claimPot: (...args: unknown[]) => claimPot(...args),
  saveTour: () => Promise.resolve(),
}));

const getRoadmap = vi.fn();
const claimRoadmapMission = vi.fn();
vi.mock("../../services/daisu/RoadmapService", () => ({
  ROADMAP_CHANGED_EVENT: "daisu:missions-changed",
  getRoadmap: (...args: unknown[]) => getRoadmap(...args),
  claimRoadmapMission: (...args: unknown[]) => claimRoadmapMission(...args),
}));

const getShop = vi.fn();
const buyShopItem = vi.fn();
vi.mock("../../services/daisu/ShopService", () => ({
  getShop: (...args: unknown[]) => getShop(...args),
  buyShopItem: (...args: unknown[]) => buyShopItem(...args),
}));

const shopItem = (over: object) => ({ key: "collectionBook", price: 5000, level: 5, owned: false, via: null, ...over });
const shopOf = (items: object[]) => ({ level: 6, walletBalance: 9000, items });

const mission = (over: object) => ({
  key: "r1-full-pot",
  goal: "fullPots",
  target: 1,
  reward: 250,
  current: 0,
  complete: false,
  claimed: false,
  claimable: false,
  ...over,
});
const roadmap = (missions: object[]) => ({ chapter: 1, chapters: 5, finished: false, bonus: 1000, missions, next: null });

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

const draw = (daisu = true, extra: Record<string, unknown> = {}) =>
  render(
    <UserContext.Provider
      value={{ userData: { id: "u1", walletBalance: 100, features: { daisu }, ...extra }, toogleUserData } as never}
    >
      <MemoryRouter>
        <DaisuDock />
        <Where />
      </MemoryRouter>
    </UserContext.Provider>
  );

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;
const jar = () => screen.getByLabelText("The jar");
// her card keeps the bonuses behind a single line, shown on hover
const showBonuses = async () => fireEvent.mouseEnter(await screen.findByRole("button", { name: /active bonuses/i }));
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
    getRoadmap.mockReset().mockResolvedValue(roadmap([]));
    claimRoadmapMission.mockReset();
    getShop.mockReset().mockResolvedValue(shopOf([]));
    buyShopItem.mockReset();
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
    await showBonuses();
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
    await showBonuses();

    expect(await screen.findByText(/play before it runs out/i)).toBeTruthy();
    expect(screen.getAllByText(/0:4\d/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/dice bonus expired/i)).toBeNull();
  });

  it("previews her bonuses without play buttons, and a click on the line goes to the first bonus game", async () => {
    getPotStatus.mockResolvedValue(
      status(CYCLE, {
        bonuses: [
          { game: "plinko", amount: 125, expiresAt: iso(200000), expired: false },
          { game: "dice", amount: 40, expiresAt: iso(100000), expired: false },
        ],
      })
    );
    draw();
    await showBonuses();

    expect(await screen.findByText(/used first on your plinko bets/i)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^play$/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /active bonuses/i }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/plinko");
  });

  it("drops the bonus line from her card once every bonus has run out", async () => {
    getPotStatus.mockResolvedValue(status(CYCLE, { bonuses: [{ game: "plinko", amount: 125, expiresAt: iso(-60000), expired: true }] }));
    draw();
    await screen.findByText(/full in \d/i);

    expect(screen.queryByRole("button", { name: /active bonuses/i })).toBeNull();
  });

  it("calls a bonus out as it runs out while she is open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getPotStatus.mockResolvedValue(status(CYCLE, { bonuses: [{ game: "dice", amount: 85, expiresAt: iso(3000), expired: false }] }));
    draw();
    await showBonuses();
    await screen.findByText(/play before it runs out/i);

    await wait(3500);

    expect(await screen.findByText(/took your dice bonus back|on dice is mine now/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /active bonuses/i })).toBeNull();
  });

  it("reads the pot again after its bonus game is played, and not after any other", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getPotStatus.mockResolvedValue(status(CYCLE, { bonuses: [{ game: "dice", amount: 85, expiresAt: iso(200000), expired: false }] }));
    draw();
    await showBonuses();
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

  it("leaves her answers to the tour while it scripts them, and cannot be poked once it locks her", async () => {
    const poked = vi.fn();
    window.addEventListener(DAISU_POKED_EVENT, poked);
    setPokeMode("script");
    draw();
    await screen.findByText(/full pot bonus/i);
    const her = screen.getByLabelText("Daisu", { selector: "button" });

    fireEvent.click(her);
    expect(poked).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/^What\?$|I'm busy|poking me|not the pot/)).toBeNull();

    act(() => setPokeMode("locked"));
    expect(her).toBeDisabled();

    act(() => setPokeMode(null));
    window.removeEventListener(DAISU_POKED_EVENT, poked);
  });

  it("offers her gift when one is waiting", async () => {
    giftReady = true;
    draw();
    expect(await screen.findByText(/daisu has a gift for you/i)).toBeTruthy();
  });

  it("counts her missions on her card, opens them in her room, and the last claim of a chapter shows what comes next", async () => {
    getRoadmap.mockResolvedValue(
      roadmap([
        mission({ key: "r1-full-pot", complete: true, claimed: true, current: 1 }),
        mission({ key: "r1-pin", goal: "pinned", complete: true, claimed: true, current: 1 }),
        mission({ key: "r1-bonus", goal: "bonusSpent", complete: true, claimed: true, current: 1 }),
        mission({ key: "r1-level", goal: "level", target: 5, current: 5, reward: 500, complete: true, claimable: true }),
      ])
    );
    claimRoadmapMission.mockResolvedValue({
      claimed: true,
      reward: 500,
      walletBalance: 1600,
      chapterDone: { chapter: 1, bonus: 1000 },
      roadmap: { ...roadmap([mission({ key: "r2-gift", goal: "giftSpins", reward: 500 })]), chapter: 2, bonus: 2000 },
    });
    draw();

    fireEvent.click(await screen.findByRole("button", { name: /4 of 4 missions complete/i }));
    expect(await screen.findByRole("dialog", { name: /daisu's room/i })).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: /^claim/i }));

    const done = await screen.findByRole("dialog", { name: /chapter 1 done/i });
    expect(claimRoadmapMission).toHaveBeenCalledWith("r1-level");
    expect(done.textContent).toMatch(/spin the daily gift/i);
    expect(toogleUserData.mock.calls[0][0].walletBalance).toBe(1600);
    fireEvent.click(screen.getByRole("button", { name: /let's go/i }));
    expect(screen.queryByRole("dialog", { name: /chapter 1 done/i })).toBeNull();
  });

  it("opens her room on her missions, and comes back", async () => {
    getRoadmap.mockResolvedValue(roadmap([mission({ key: "r1-level", goal: "level", target: 5, current: 3, reward: 500 })]));
    draw();
    fireEvent.click(await screen.findByText(/visit daisu's room/i));

    expect(await screen.findByRole("dialog", { name: /daisu's room/i })).toBeTruthy();
    expect(await screen.findByText("First steps")).toBeTruthy();
    expect(screen.getByText("Reach level 5")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Shop" }));
    expect(await screen.findByText(/things that open up the rest of the place/i)).toBeTruthy();

    fireEvent.click(screen.getByText(/back to daisu/i));
    expect(await screen.findByLabelText("Daisu", { selector: "section" })).toBeTruthy();
  });

  it("folds into her bubble to show how a mission is done", async () => {
    getRoadmap.mockResolvedValue(roadmap([mission({ key: "r1-level", goal: "level", target: 5, current: 3, reward: 500 })]));
    draw();
    fireEvent.click(await screen.findByText(/visit daisu's room/i));
    fireEvent.click(await screen.findByRole("button", { name: /help/i }));
    fireEvent.click(screen.getByRole("button", { name: "Show me" }));

    expect(await screen.findByLabelText("Open Daisu")).toBeTruthy();
    expect(helpState()).toMatchObject({ owner: "u1", mission: "r1-level", goal: "level", title: "Reach level 5" });
    endHelp();
  });

  it("sells from her shop, and offers to show what the item opened", async () => {
    getShop.mockResolvedValue(shopOf([shopItem({})]));
    buyShopItem.mockResolvedValue({
      bought: true,
      key: "collectionBook",
      walletBalance: 4000,
      unlocks: ["collectionBook"],
      shop: shopOf([shopItem({ owned: true, via: "bought" })]),
    });
    draw(true, { walletBalance: 9000, level: 6, unlocks: [] });
    fireEvent.click(await screen.findByText(/visit daisu's room/i));
    fireEvent.click(await screen.findByRole("button", { name: "Shop" }));
    fireEvent.click(await screen.findByRole("button", { name: "Buy" }));

    fireEvent.click(await screen.findByRole("button", { name: /buy for/i }));

    expect(await screen.findByRole("dialog", { name: /unlocked · collection book/i })).toBeTruthy();
    expect(buyShopItem).toHaveBeenCalledWith("collectionBook");
    expect(toogleUserData.mock.calls[toogleUserData.mock.calls.length - 1][0]).toMatchObject({ walletBalance: 4000, unlocks: ["collectionBook"] });

    fireEvent.click(screen.getByRole("button", { name: "Show me" }));

    expect(await screen.findByLabelText("Open Daisu")).toBeTruthy();
    expect(helpState()).toMatchObject({ mission: "shop:collectionBook", goal: "unlock:collectionBook" });
    endHelp();
  });

  it("opens her shop on the item a locked page needs", async () => {
    getShop.mockResolvedValue(shopOf([shopItem({ key: "chatPass", price: 500 })]));
    draw(true, { walletBalance: 9000, level: 6, unlocks: [] });
    await screen.findByLabelText("Daisu", { selector: "section" });

    act(() => openDaisuShop("chatPass"));

    expect(await screen.findByRole("dialog", { name: "Chat Pass" })).toBeTruthy();
    expect(screen.getByRole("dialog", { name: /daisu's room/i })).toBeTruthy();
  });

  it("starts folded into her bubble on a first visit", async () => {
    window.localStorage.clear();
    draw();

    expect(await screen.findByLabelText("Open Daisu")).toBeTruthy();
    expect(screen.queryByLabelText("Daisu", { selector: "section" })).toBeNull();
  });

  it("keeps quiet on her card while her tour runs, and talks again once it ends", async () => {
    act(() => syncTour("quiet-1", { status: "active", step: "pot" }));
    draw();
    await screen.findByText(/full pot bonus/i);
    expect(document.querySelector('section[aria-label="Daisu"] p')).toBeNull();

    act(() => endTour());
    fireEvent.click(screen.getByLabelText("Close"));
    fireEvent.click(await screen.findByLabelText("Open Daisu"));
    await waitFor(() => expect(document.querySelector('section[aria-label="Daisu"] p')?.textContent).toBeTruthy());
    act(() => syncTour(null, null));
  });

  it("folds into the bubble and remembers that", async () => {
    draw();
    fireEvent.click(await screen.findByLabelText("Close"));

    expect(await screen.findByLabelText("Open Daisu")).toBeTruthy();
    expect(window.localStorage.getItem("kani.daisuStage")).toBe("bubble");
  });
});
