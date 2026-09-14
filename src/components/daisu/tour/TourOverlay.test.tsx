import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import TourOverlay from "./TourOverlay";
import UserContext from "../../../UserContext";
import { DAISU_STAGE_EVENT, emitCaseRevealed, emitGameResult, emitJarTaken } from "./tourEvents";

const saveTour = vi.fn();
vi.mock("../../../services/daisu/DaisuService", () => ({
  saveTour: (...args: unknown[]) => saveTour(...args),
}));

type Onboarding = { status: "offered" | "active" | "skipped" | "done"; step: string | null } | null;

let accounts = 0;
const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

// every render signs in a new account: the tour's store lives outside react and outlasts a render
const draw = (onboarding: Onboarding, path = "/", page: ReactNode = null, daisu = true) => {
  accounts += 1;
  return render(
    <UserContext.Provider
      value={{ userData: { id: `tour-${accounts}`, walletBalance: 500, features: { daisu }, onboarding } } as never}
    >
      <MemoryRouter initialEntries={[path]}>
        <Where />
        {page}
        <TourOverlay />
      </MemoryRouter>
    </UserContext.Provider>
  );
};

const where = () => screen.getByTestId("where").textContent;
const stages: string[] = [];
const onStage = (e: Event) => stages.push((e as CustomEvent<string>).detail);
const lastSave = () => saveTour.mock.calls[saveTour.mock.calls.length - 1]?.filter((arg: unknown) => arg !== undefined);

describe("daisu's first-login tour", () => {
  beforeEach(() => {
    saveTour.mockReset().mockResolvedValue(undefined);
    stages.length = 0;
    window.addEventListener(DAISU_STAGE_EVENT, onStage);
  });

  afterEach(() => {
    window.removeEventListener(DAISU_STAGE_EVENT, onStage);
    vi.useRealTimers();
  });

  it("stays away from accounts made before it and from accounts outside the beta", () => {
    draw(null);
    draw({ status: "offered", step: null }, "/", null, false);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("welcomes a new account, and a no ends it for good", () => {
    draw({ status: "offered", step: null });
    expect(screen.getByRole("dialog", { name: /a new face/i })).toBeTruthy();

    fireEvent.click(screen.getByText(/i'll figure it out/i));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(lastSave()).toEqual(["skipped"]);
  });

  it("takes closing her welcome as a no", () => {
    draw({ status: "offered", step: null });
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(lastSave()).toEqual(["skipped"]);
  });

  it("opens her card for the pot and moves on to the cases once the jar is taken", () => {
    draw({ status: "offered", step: null }, "/market");
    fireEvent.click(screen.getByText(/show me around/i));

    expect(stages).toContain("popup");
    expect(screen.getByText(/waiting for your click/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^next$/i })).toBeNull();

    act(() => emitJarTaken());
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(where()).toBe("/");
    expect(screen.getByText(/pick any case/i)).toBeTruthy();
    expect(lastSave()).toEqual(["active", "case"]);
  });

  it("waits as a chip away from the page a step needs, and takes the player back to it", () => {
    draw({ status: "active", step: "case" }, "/market");
    fireEvent.click(screen.getByText(/continue the tour/i));

    expect(where()).toBe("/");
    expect(screen.getByText(/pick any case/i)).toBeTruthy();
  });

  it("points at the reel while a case rolls, then reacts to the best thing that dropped", async () => {
    const page = (
      <div data-tour="case-open" data-tour-state="busy">
        <button>Open</button>
      </div>
    );
    draw({ status: "active", step: "open" }, "/case/kilowatt", page);

    expect(await screen.findByText(/eyes on the reel/i)).toBeTruthy();

    act(() =>
      emitCaseRevealed([
        { name: "Shiba", rarity: 1, sellValue: 2 },
        { name: "Sakuya", rarity: 3, sellValue: 34 },
      ])
    );

    expect(screen.getByText(/an epic sakuya, first try/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByRole("dialog", { name: /a game/i })).toBeTruthy();
  });

  it("offers another case when the one picked costs more than the player has", async () => {
    const page = (
      <div data-tour="case-open" data-tour-state="too-expensive">
        <button>Open</button>
      </div>
    );
    draw({ status: "active", step: "open" }, "/case/golden", page);

    fireEvent.click(await screen.findByRole("button", { name: /pick another case/i }));

    expect(where()).toBe("/");
    expect(lastSave()).toEqual(["active", "case"]);
  });

  it("walks the chosen game from its bet to a round, then closes on how the round went", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    draw({ status: "active", step: "game" }, "/", <button data-tour="play-button">Roll</button>);

    fireEvent.click(screen.getByText("Dice"));
    expect(where()).toBe("/dice");
    expect(screen.getByText(/dice picks a number/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByText(/waiting for your play/i)).toBeTruthy();

    fireEvent.click(screen.getByText("Roll"));
    expect(screen.getByText(/i'm watching/i)).toBeTruthy();

    act(() => emitGameResult({ game: "plinko", wagered: 10, payout: 30 }));
    act(() => emitGameResult({ game: "dice", wagered: 10, payout: 0 }));
    await act(async () => {
      vi.advanceTimersByTime(1300);
    });

    expect(screen.getByRole("dialog", { name: /tour done/i })).toBeTruthy();
    expect(screen.getByText(/lost\? everyone does/i)).toBeTruthy();
    expect(lastSave()).toEqual(["done", "done"]);

    fireEvent.click(screen.getByText(/show me my missions/i));
    expect(stages[stages.length - 1]).toBe("room");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
