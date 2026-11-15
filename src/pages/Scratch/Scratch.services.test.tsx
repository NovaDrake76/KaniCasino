import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserContext from "../../UserContext";
import { WIPE_MS, useScratchServices } from "./Scratch.services";
import type { Board, PanelView, Stage, TreasureBoard } from "./Scratch.types";

const buyScratch = vi.fn();
const pickScratch = vi.fn();
const getActiveScratch = vi.fn();
const track = vi.fn();
const play = vi.fn();
const toogleUserFlow = vi.fn();
const toastError = vi.fn();
vi.mock("../../services/games/GamesServices", () => ({
  buyScratch: (...args: unknown[]) => buyScratch(...args),
  pickScratch: (...args: unknown[]) => pickScratch(...args),
  getActiveScratch: (...args: unknown[]) => getActiveScratch(...args),
}));
vi.mock("../../stats/SessionStatsContext", () => ({ useSessionStats: () => ({ track }) }));
vi.mock("../../services/sound/sound", () => ({ play: (...args: unknown[]) => play(...args) }));
vi.mock("react-toastify", () => ({ toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() } }));

// the wallet the navbar would show: every write the hook makes goes through the app's setter, applied here
let wallet = 0;
const toogleUserData = vi.fn((update: unknown) => {
  const next = typeof update === "function" ? update({ walletBalance: wallet }) : update;
  wallet = (next as { walletBalance: number }).walletBalance;
});

const wrapperFor =
  (userData: unknown) =>
  ({ children }: { children: React.ReactNode }) => (
    <UserContext.Provider value={{ userData, toogleUserData, toogleUserFlow } as never}>
      <MemoryRouter>{children}</MemoryRouter>
    </UserContext.Provider>
  );

const nineStack = {
  ticket: "nine",
  price: 100,
  quantity: 3,
  tickets: [
    { lucky: ["nine", "frog"], multiplier: 1, payout: 0, spots: Array(8).fill({ symbol: "star", prize: 100 }), winningSpots: [], rollId: "R100000001" },
    {
      lucky: ["nine", "frog"],
      multiplier: 2,
      payout: 400,
      spots: [{ symbol: "nine", prize: 200 }, ...Array(7).fill({ symbol: "star", prize: 100 })],
      winningSpots: [0],
      rollId: "R100000002",
    },
    {
      lucky: ["heart", "gem"],
      multiplier: 1,
      payout: 2500,
      spots: [{ symbol: "gem", prize: 2500 }, ...Array(7).fill({ symbol: "star", prize: 100 })],
      winningSpots: [0],
      rollId: "R100000003",
    },
  ],
  totalPayout: 2900,
  balanceAfterCharge: 700,
  balance: 3600,
};

const pocketOne = {
  ticket: "pocket",
  price: 10,
  quantity: 1,
  tickets: [
    {
      symbol: "coins",
      multiplier: 5,
      payout: 50,
      cells: ["coins", "star", "chest", "clover", "coins", "star", "gem", "clover", "coins"],
      line: [0, 4, 8],
      winningCells: [0, 4, 8],
      rollId: "R123456789",
    },
  ],
  totalPayout: 50,
  balanceAfterCharge: 990,
  balance: 1040,
};

const treasureBought = {
  ticket: "treasure",
  price: 1000,
  quantity: 1,
  game: { id: "SC000000123", ticket: "treasure", price: 1000, status: "active", picks: [], left: 3, board: null, payout: 0, rollId: null },
  balanceAfterCharge: 4000,
  balance: 4000,
};

const board = [0, 500, 0, 2500, 0, 1000, 0, 0, 500];
const answer = (cell: number, picks: number[], settled = false) => ({
  id: "SC000000123",
  ticket: "treasure",
  price: 1000,
  status: settled ? "settled" : "active",
  picks: picks.map((c) => ({ cell: c, find: board[c] })),
  left: 3 - picks.length,
  board: settled ? board : null,
  payout: settled ? picks.reduce((s, c) => s + board[c], 0) : 0,
  rollId: settled ? "R555000111" : null,
  cell,
  find: board[cell],
  balance: settled ? 4000 + picks.reduce((s, c) => s + board[c], 0) : undefined,
});

const player = { id: "u1", walletBalance: 5000 };

const ticketStage = (stage: Stage) => {
  if (stage.kind !== "ticket") throw new Error("not a ticket");
  return stage;
};
const treasureBoard = (b: Board): TreasureBoard => {
  if (b.kind !== "treasure") throw new Error("not treasure");
  return b;
};
const detailsOf = (panel: PanelView) => {
  if (panel.kind !== "details") throw new Error("not the details");
  return panel.details;
};
const reserveOf = (panel: PanelView) => {
  if (panel.kind !== "details") throw new Error("not the details");
  return panel.reserve.map((d) => d.id);
};
const progressOf = (panel: PanelView) => {
  if (panel.kind !== "progress") throw new Error("not the progress");
  return panel.progress;
};
const marks = (panel: PanelView) => progressOf(panel).pips?.items.map((p) => (p.current ? `${p.mark}*` : p.mark));
const plain = (s: string) => s.replace(/\s/g, " ");
const sounds = () => play.mock.calls.map(([name]) => name);

const render = () => renderHook(() => useScratchServices(), { wrapper: wrapperFor(player) });

describe("the scratch page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wallet = 5000;
    getActiveScratch.mockResolvedValue({ game: null });
  });
  afterEach(() => vi.useRealTimers());

  it("opens on the catalogue and fills the panel with the selected ticket", async () => {
    const { result } = render();
    await waitFor(() => expect(getActiveScratch).toHaveBeenCalled());
    const stage = result.current.stage;
    expect(stage.kind).toBe("catalogue");
    if (stage.kind !== "catalogue") return;
    expect(stage.cards.map((c) => [c.id, c.selected])).toEqual([
      ["pocket", true],
      ["nine", false],
      ["treasure", false],
    ]);
    expect(stage.cards.map((c) => [c.topLabel, plain(c.top), plain(c.price)])).toEqual([
      ["Top prize", "K₽ 1,000", "K₽ 10"],
      ["Top prize", "K₽ 100,000", "K₽ 100"],
      ["Top prize", "K₽ 300,000", "K₽ 1,000"],
    ]);
    expect(detailsOf(result.current.panel).name).toBe("Pocket Change");
    expect(detailsOf(result.current.panel).key.kind).toBe("rows");
    // the other two are handed over too, only to hold the tallest one's height
    expect(reserveOf(result.current.panel)).toEqual(["nine", "treasure"]);
    expect(result.current.quantityRow).toBe("shown");

    act(() => stage.select("nine"));
    expect(detailsOf(result.current.panel).name).toBe("Perfect Nine");
    expect(reserveOf(result.current.panel)).toEqual(["pocket", "treasure"]);
    expect(detailsOf(result.current.panel).rules).toEqual(["**Match a lucky symbol** to win its prize.", "The multiplier boosts every win."]);
    const key = detailsOf(result.current.panel).key;
    expect(key.kind === "chips" && key.groups.map((g) => g.values.length)).toEqual([8, 4]);
    act(() => result.current.chooseQuantity(5));
    expect(result.current.action.label.replace(/\s/g, " ")).toBe("Buy 5 for K₽ 500");

    act(() => (result.current.stage as Extract<Stage, { kind: "catalogue" }>).select("treasure"));
    // treasure is sold one at a time, but the count row keeps its place so the buy button does not move
    expect(result.current.quantityRow).toBe("held");
    expect(result.current.quantity).toBe(1);
    expect(result.current.action.label.replace(/\s/g, " ")).toBe("Buy 1 for K₽ 1,000");
  });

  it("buys a stack in one request and shows only the charge until each ticket is scratched", async () => {
    buyScratch.mockResolvedValue(nineStack);
    const { result } = render();
    act(() => (result.current.stage as Extract<Stage, { kind: "catalogue" }>).select("nine"));
    act(() => result.current.chooseQuantity(3));
    await act(async () => {
      await result.current.action.onClick();
    });
    expect(buyScratch).toHaveBeenCalledWith("nine", 3);
    expect(wallet).toBe(700);
    let stage = ticketStage(result.current.stage);
    expect(stage.counter).toBe("Ticket 1 of 3");
    expect(stage.ticket.board.kind).toBe("nine");
    // nothing to say until a ticket is scratched, and the finished row is laid out but not shown
    expect(stage.result).toBeNull();
    expect(stage.finished.shown).toBe(false);
    expect(result.current.showRevealStack).toBe(true);
    // the panel stops repeating the prize key: the stack's pips and what it has paid so far
    const progress = progressOf(result.current.panel);
    expect([progress.name, plain(progress.price), progress.pips?.label]).toEqual(["Perfect Nine", "K₽ 100", "Ticket 1 of 3"]);
    expect(marks(result.current.panel)).toEqual(["unscratched*", "unscratched", "unscratched"]);
    expect(progressOf(result.current.panel).lines.map((l) => [l.label, plain(l.value)])).toEqual([["Won so far", "K₽ 0"]]);
    // the second summary line's place is held while the stack plays
    expect(progressOf(result.current.panel).heldLines).toBe(1);
    expect(result.current.quantityRow).toBeNull();

    act(() => (ticketStage(result.current.stage).ticket.board as Extract<Board, { kind: "nine" }>).coating.onComplete());
    expect(wallet).toBe(700);
    stage = ticketStage(result.current.stage);
    expect(stage.result).toEqual({ kind: "lost", text: "No match this time." });
    expect(result.current.action.label).toBe("Next ticket");
    expect(marks(result.current.panel)).toEqual(["lost*", "unscratched", "unscratched"]);

    act(() => result.current.action.onClick());
    expect(marks(result.current.panel)).toEqual(["lost", "unscratched*", "unscratched"]);
    act(() => (ticketStage(result.current.stage).ticket.board as Extract<Board, { kind: "nine" }>).coating.onComplete());
    expect(wallet).toBe(1100);
    expect(plain(ticketStage(result.current.stage).result?.text || "")).toBe("1 match, times 2. Won K₽ 400.");
    // a ticket of a stack still to finish says what it won, and the buy again row stays unseen
    expect(ticketStage(result.current.stage).finished.shown).toBe(false);
    expect(marks(result.current.panel)).toEqual(["lost", "won*", "unscratched"]);
    expect(plain(progressOf(result.current.panel).lines[0].value)).toBe("K₽ 400");

    act(() => result.current.revealStack());
    expect(wallet).toBe(3600);
    stage = ticketStage(result.current.stage);
    expect(stage.summary).toMatchObject({ count: "3" });
    expect(marks(result.current.panel)).toEqual(["lost", "won", "won*"]);
    expect(progressOf(result.current.panel).lines.map((l) => [l.label, plain(l.value)])).toEqual([
      ["Total won", "K₽ 2,900"],
      ["Best ticket", "25x, K₽ 2,500"],
    ]);
    expect(progressOf(result.current.panel).heldLines).toBe(0);
    expect(stage.finished).toMatchObject({ shown: true, buyAgain: { label: "Buy again", disabled: false } });
    expect(track).toHaveBeenCalledTimes(3);
    expect(play).toHaveBeenCalledWith("game.bigwin");

    buyScratch.mockResolvedValue(nineStack);
    await act(async () => {
      await ticketStage(result.current.stage).finished.buyAgain.onClick();
    });
    expect(buyScratch).toHaveBeenLastCalledWith("nine", 3);

    act(() => result.current.revealStack());
    act(() => ticketStage(result.current.stage).finished.back.onClick());
    expect(result.current.stage.kind).toBe("catalogue");
  });

  it("reveals one pocket ticket with reveal all once the wipe has run", async () => {
    vi.useFakeTimers();
    buyScratch.mockResolvedValue(pocketOne);
    const { result } = render();
    await act(async () => {
      await result.current.action.onClick();
    });
    expect(result.current.action.label).toBe("Reveal all");
    act(() => result.current.action.onClick());
    expect(wallet).toBe(990);
    act(() => vi.advanceTimersByTime(WIPE_MS));
    const stage = ticketStage(result.current.stage);
    expect(plain(stage.result?.text || "")).toBe("Three coin stacks in a line. Won K₽ 50.");
    const pocket = stage.ticket.board as Extract<Board, { kind: "pocket" }>;
    expect(pocket.cells.filter((c) => c.mark === "win")).toHaveLength(3);
    expect(pocket.cells.filter((c) => c.mark === "dim")).toHaveLength(6);
    expect(wallet).toBe(1040);
    expect(stage.ticket.serial).toBe("No. 3456 789");
    expect(stage.ticket.verify).not.toBeNull();
    // a stack of one has nothing to count: the panel keeps the name and the price
    const progress = progressOf(result.current.panel);
    expect([progress.name, progress.pips, progress.lines]).toEqual(["Pocket Change", null, []]);
    expect(sounds()).toContain("game.win");
  });

  it("calls a stack ticket that pays less than its price a find: neutral, and neither the win nor the lose sound", async () => {
    vi.useFakeTimers();
    const under = { ...nineStack.tickets[1], multiplier: 1, payout: 50, spots: [{ symbol: "nine", prize: 50 }, ...nineStack.tickets[1].spots.slice(1)] };
    buyScratch.mockResolvedValue({ ...nineStack, quantity: 1, tickets: [under], totalPayout: 50, balance: 750 });
    const { result } = render();
    act(() => (result.current.stage as Extract<Stage, { kind: "catalogue" }>).select("nine"));
    await act(async () => {
      await result.current.action.onClick();
    });
    play.mockClear();
    act(() => result.current.action.onClick());
    act(() => vi.advanceTimersByTime(WIPE_MS));
    const stage = ticketStage(result.current.stage);
    expect({ ...stage.result, text: plain(stage.result?.text || "") }).toEqual({ kind: "found", text: "Found K₽ 50." });
    expect(sounds()).toEqual(["scratch.reveal"]);
    expect(wallet).toBe(750);
  });

  it("plays a treasure ticket: three claims, a refused fourth, and the balance only once the third spot is scratched", async () => {
    buyScratch.mockResolvedValue(treasureBought);
    pickScratch.mockImplementation((_id: string, cell: number) => {
      const order = pickScratch.mock.calls.map(([, c]) => c as number);
      return Promise.resolve(answer(cell, order, order.length === 3));
    });
    const { result } = render();
    act(() => (result.current.stage as Extract<Stage, { kind: "catalogue" }>).select("treasure"));
    await act(async () => {
      await result.current.action.onClick();
    });
    expect(buyScratch).toHaveBeenCalledWith("treasure", 1);
    expect(wallet).toBe(4000);
    const spots = () => treasureBoard(ticketStage(result.current.stage).ticket.board).spots;
    expect(ticketStage(result.current.stage).ticket.rules).toEqual(["**Scratch 3 only.** 3 left."]);
    expect(spots().every((s) => s.coating.active && s.find === null)).toBe(true);

    for (const cell of [1, 3]) {
      await act(async () => {
        expect(spots()[cell].coating.onStart()).toBe(true);
      });
      act(() => spots()[cell].coating.onComplete());
    }
    expect(spots()[1]).toMatchObject({ mark: "open", find: { symbol: "mushroom", amount: "500" } });
    expect(ticketStage(result.current.stage).ticket.rules).toEqual(["**Scratch 3 only.** 1 left."]);
    // a 500 find on a 1,000 ticket is a find, not a win; the panel counts only what has been scratched
    expect(marks(result.current.panel)).toEqual(["found", "won", "unscratched"]);
    expect(progressOf(result.current.panel).lines.map((l) => [l.label, plain(l.value)])).toEqual([["Found so far", "K₽ 3,000"]]);

    await act(async () => {
      expect(spots()[0].coating.onStart()).toBe(true);
    });
    expect(marks(result.current.panel)).toEqual(["found", "won", "unscratched*"]);
    expect(plain(progressOf(result.current.panel).lines[0].value)).toBe("K₽ 3,000");
    expect(spots()[4].coating.active).toBe(false);
    expect(spots()[4].coating.onStart()).toBe(false);
    expect(pickScratch).toHaveBeenCalledTimes(3);
    // the third answer carries the final balance, but the spot is still under foil
    expect(wallet).toBe(4000);
    expect(ticketStage(result.current.stage).finished).toMatchObject({ shown: false, buyAgain: { disabled: true }, back: { disabled: true } });
    expect(ticketStage(result.current.stage).result).toBeNull();
    expect(result.current.action).toMatchObject({ disabled: true });

    act(() => spots()[0].coating.onComplete());
    const stage = ticketStage(result.current.stage);
    expect(wallet).toBe(7000);
    expect({ ...stage.result, text: plain(stage.result?.text || "") }).toEqual({ kind: "won", text: "Won K₽ 3,000." });
    expect(spots().filter((s) => s.mark === "kept").map((s) => s.cell)).toEqual([0, 1, 3]);
    expect(spots().filter((s) => s.mark === "missed")).toHaveLength(6);
    expect(spots()[5].find).toMatchObject({ symbol: "star", amount: "1,000" });
    expect(stage.finished).toMatchObject({ shown: true, back: { label: "Back to the catalogue", disabled: false } });
    expect(stage.ticket.serial).toBe("No. 5000 111");
    expect(track).toHaveBeenCalledWith({ game: "scratch", wagered: 1000, payout: 3000 });
    expect(sounds()).toContain("game.win");
    expect(marks(result.current.panel)).toEqual(["found", "won", "lost"]);
    expect(progressOf(result.current.panel).lines.map((l) => [l.label, plain(l.value)])).toEqual([["Total found", "K₽ 3,000"]]);
  });

  it("finishes a treasure ticket that found less than its price on a neutral line, with no win or lose sound", async () => {
    buyScratch.mockResolvedValue(treasureBought);
    pickScratch.mockImplementation((_id: string, cell: number) => {
      const order = pickScratch.mock.calls.map(([, c]) => c as number);
      return Promise.resolve(answer(cell, order, order.length === 3));
    });
    const { result } = render();
    act(() => (result.current.stage as Extract<Stage, { kind: "catalogue" }>).select("treasure"));
    await act(async () => {
      await result.current.action.onClick();
    });
    const spots = () => treasureBoard(ticketStage(result.current.stage).ticket.board).spots;
    for (const cell of [1, 0, 2]) {
      await act(async () => {
        spots()[cell].coating.onStart();
      });
      act(() => spots()[cell].coating.onComplete());
    }
    const stage = ticketStage(result.current.stage);
    expect({ ...stage.result, text: plain(stage.result?.text || "") }).toEqual({ kind: "found", text: "Found K₽ 500." });
    expect(sounds()).not.toContain("game.win");
    expect(sounds()).not.toContain("game.lose");
    expect(wallet).toBe(4500);
    expect(track).toHaveBeenCalledWith({ game: "scratch", wagered: 1000, payout: 500 });
    expect(marks(result.current.panel)).toEqual(["found", "lost", "lost"]);
  });

  it("hands a spot back with its foil whole when the pick fails", async () => {
    buyScratch.mockResolvedValue(treasureBought);
    pickScratch.mockRejectedValue({ response: { data: { message: "Too many actions, slow down a little." } } });
    const { result } = render();
    act(() => (result.current.stage as Extract<Stage, { kind: "catalogue" }>).select("treasure"));
    await act(async () => {
      await result.current.action.onClick();
    });
    const spots = () => treasureBoard(ticketStage(result.current.stage).ticket.board).spots;
    const before = spots()[2].coating.key;
    await act(async () => {
      spots()[2].coating.onStart();
    });
    expect(toastError).toHaveBeenCalledWith("Too many actions, slow down a little.", { theme: "dark" });
    expect(spots()[2].coating.key).not.toBe(before);
    expect(spots()[2].coating.active).toBe(true);
    expect(ticketStage(result.current.stage).ticket.rules).toEqual(["**Scratch 3 only.** 3 left."]);
  });

  it("opens straight into a treasure ticket left open, with its picked spots already scratched", async () => {
    getActiveScratch.mockResolvedValue({ game: { ...treasureBought.game, picks: [{ cell: 7, find: 0 }], left: 2 } });
    const { result } = render();
    await waitFor(() => expect(result.current.stage.kind).toBe("ticket"));
    const spots = treasureBoard(ticketStage(result.current.stage).ticket.board).spots;
    expect(spots[7]).toMatchObject({ mark: "open", find: { symbol: null, amount: "" } });
    expect(spots[7].coating.state).toBe("faded");
    expect(ticketStage(result.current.stage).ticket.rules).toEqual(["**Scratch 3 only.** 2 left."]);
    expect(progressOf(result.current.panel).name).toBe("Borrowed Treasure");
    expect(marks(result.current.panel)).toEqual(["lost", "unscratched", "unscratched"]);
  });

  it("asks a signed-out visitor to sign in, and will not buy what the wallet cannot cover", async () => {
    const out = renderHook(() => useScratchServices(), { wrapper: wrapperFor(null) });
    expect(out.result.current.action.label).toBe("Sign in to play");
    act(() => out.result.current.action.onClick());
    expect(toogleUserFlow).toHaveBeenCalledWith(true);
    expect(getActiveScratch).not.toHaveBeenCalled();

    const poor = renderHook(() => useScratchServices(), { wrapper: wrapperFor({ id: "u2", walletBalance: 50 }) });
    act(() => (poor.result.current.stage as Extract<Stage, { kind: "catalogue" }>).select("nine"));
    expect(poor.result.current.action.disabled).toBe(true);
  });

  it("puts the true balance back when the page closes on a stack still covered", async () => {
    buyScratch.mockResolvedValue(nineStack);
    const { result, unmount } = render();
    act(() => (result.current.stage as Extract<Stage, { kind: "catalogue" }>).select("nine"));
    act(() => result.current.chooseQuantity(3));
    await act(async () => {
      await result.current.action.onClick();
    });
    expect(wallet).toBe(700);
    unmount();
    expect(wallet).toBe(3600);
  });
});
