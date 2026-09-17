import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, useLocation } from "react-router-dom";
import HelpOverlay from "./HelpOverlay";
import UserContext from "../../../UserContext";
import { DAISU_STAGE_EVENT, emitGameResult, emitItemPinned } from "./tourEvents";
import { endHelp, helpState, startHelp } from "./helpStore";
import { syncTour } from "./tourStore";
import { wizardFor } from "./helpWizards";
import { setPotStatus } from "../potStore";
import type { PotStatus } from "../../../services/daisu/DaisuService";

vi.mock("../../../services/daisu/DaisuService", () => ({
  saveTour: () => Promise.resolve(),
}));

// every goal the roadmap catalog uses
const GOALS = [
  "fullPots", "pinned", "bonusSpent", "level", "giftSpins", "itemsSold", "gamesTried", "giftStreak",
  "marketTrades", "collectionVisits", "casesOpened", "collectionsCompleted", "staked", "battlesWon", "topFan",
];

let accounts = 0;
// a new account per test: the help and the tour live outside react and outlast a render
const nextId = () => `help-${++accounts}`;

const Where = () => {
  const { pathname, search } = useLocation();
  return <span data-testid="where">{pathname + search}</span>;
};

const draw = (id: string, goal: string, path = "/", page: ReactNode = null, title = "A mission", extra: Record<string, unknown> = {}) => {
  startHelp(id, "r-test", goal, title);
  return render(
    <UserContext.Provider value={{ userData: { id, features: { daisu: true }, ...extra } } as never}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        {page}
        <HelpOverlay />
      </MemoryRouter>
    </UserContext.Provider>
  );
};

const where = () => screen.getByTestId("where").textContent;
const stages: string[] = [];
const onStage = (e: Event) => stages.push((e as CustomEvent<string>).detail);

const pot = (over: Partial<PotStatus> = {}): PotStatus => ({
  fill: 0.5,
  full: 1000,
  amount: 500,
  fullAt: new Date(Date.now() + 240000).toISOString(),
  cycleMs: 480000,
  clickRate: 0.8,
  fullBonus: 0.25,
  creditShare: 0.1,
  pick: "plinko",
  nextPick: "dice",
  pickProgress: 0.2,
  creditTtlMs: 480000,
  bonuses: [],
  ...over,
});

describe("daisu showing how a mission is done", () => {
  beforeEach(() => {
    stages.length = 0;
    window.addEventListener(DAISU_STAGE_EVENT, onStage);
  });

  afterEach(() => {
    window.removeEventListener(DAISU_STAGE_EVENT, onStage);
    act(() => {
      endHelp();
      setPotStatus(null);
    });
    vi.useRealTimers();
  });

  it("knows how to show every goal her missions use", () => {
    expect(GOALS.filter((goal) => !wizardFor(goal))).toEqual([]);
  });

  it("takes the player to their inventory, shows every heart, and waits for a pin", () => {
    const id = nextId();
    draw(id, "pinned", "/marketplace", null, "Pin a character");

    expect(where()).toBe(`/profile/${id}`);
    expect(screen.getByRole("dialog", { name: /help · pin a character/i })).toBeTruthy();
    expect(screen.getByText(/waiting for the heart/i)).toBeTruthy();
    expect(document.body.classList.contains("daisu-help-pin")).toBe(true);

    act(() => emitItemPinned());

    expect(screen.getByText(/pinned\. everyone who opens your profile/i)).toBeTruthy();
    expect(document.body.classList.contains("daisu-help-pin")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(helpState().mission).toBeNull();
  });

  it("says so when the inventory has nothing to pin", async () => {
    draw(nextId(), "pinned", "/", <h2 data-tour="inventory-empty">No items</h2>);

    expect(await screen.findByText(/nothing to pin yet/i)).toBeTruthy();
  });

  it("ends once the player walks off the page it is showing", () => {
    draw(nextId(), "giftSpins", "/", <Link to="/marketplace">Market</Link>);
    expect(where()).toBe("/gift");
    expect(screen.getByText(/pick a collection/i)).toBeTruthy();

    fireEvent.click(screen.getByText("Market"));

    expect(where()).toBe("/marketplace");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("walks the gift from a collection to the spin, and the spin ends it", async () => {
    const GiftPage = () => {
      const [picked, setPicked] = useState(false);
      return picked ? (
        <button data-tour="gift-spin">Spin the daily gift</button>
      ) : (
        <button data-tour="gift-pick" onClick={() => setPicked(true)}>
          Spin
        </button>
      );
    };
    draw(nextId(), "giftStreak", "/gift", <GiftPage />);

    fireEvent.click(await screen.findByText("Spin"));
    expect(await screen.findByText(/now spin\. then come back tomorrow/i)).toBeTruthy();
    fireEvent.click(screen.getByText("Spin the daily gift"));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("points at the timer when today's gift is already spun", async () => {
    draw(nextId(), "giftSpins", "/gift", <div data-tour="gift-next">3:59:12</div>);

    expect(await screen.findByText(/you already spun today/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets the player pick a game, then walks them from the bet to a round", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    draw(nextId(), "level", "/", <button data-tour="play-button">Roll</button>, "Reach level 5");

    fireEvent.click(screen.getByText("Dice"));
    expect(where()).toBe("/dice");
    expect(screen.getByText(/dice picks a number/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    fireEvent.click(screen.getByText("Roll"));
    expect(screen.getByText(/i'm watching/i)).toBeTruthy();

    act(() => emitGameResult({ game: "plinko", wagered: 10, payout: 0 }));
    act(() => emitGameResult({ game: "dice", wagered: 10, payout: 0 }));
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.queryByText(/i'm watching/i)).toBeNull();
    expect(helpState().mission).toBeNull();
  });

  it("has her jar taken first when no bonus is running, then shows the bonus on its game", () => {
    act(() => setPotStatus(pot()));
    draw(nextId(), "bonusSpent", "/marketplace");

    expect(stages).toContain("popup");
    expect(screen.getByText(/no bonus right now.*plinko/i)).toBeTruthy();

    const bonus = { game: "plinko" as const, amount: 12, expiresAt: new Date(Date.now() + 480000).toISOString(), expired: false };
    act(() => setPotStatus(pot({ bonuses: [bonus] })));

    expect(where()).toBe("/plinko");
    expect(stages[stages.length - 1]).toBe("bubble");
    expect(screen.getByText(/that's my bonus, right above your bet/i)).toBeTruthy();
  });

  it("opens the chat and points at where to type once a chat pass is bought", () => {
    const opened = vi.fn();
    window.addEventListener("chat:open", opened);
    draw(nextId(), "unlock:chatPass", "/", <form data-tour="chat-input" />, "Chat Pass");

    expect(opened).toHaveBeenCalled();
    expect(screen.getByText(/type here and everyone sees it/i)).toBeTruthy();
    window.removeEventListener("chat:open", opened);
  });

  it("sends a player without the collection book to her shop rather than to a locked page", () => {
    const asked: string[] = [];
    const onShop = (e: Event) => asked.push((e as CustomEvent<string>).detail);
    window.addEventListener("daisu:shop", onShop);

    draw(nextId(), "collectionVisits", "/marketplace", null, "Look through a collection", { unlocks: [] });

    expect(asked).toEqual(["collectionBook"]);
    expect(where()).toBe("/marketplace");
    expect(helpState().mission).toBeNull();
    window.removeEventListener("daisu:shop", onShop);
  });

  it("stays out of the way while the first-login tour runs", () => {
    const id = nextId();
    syncTour(id, { status: "active", step: "case" });
    draw(id, "casesOpened", "/marketplace");

    expect(where()).toBe("/marketplace");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
