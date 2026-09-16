import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import TourOverlay from "./TourOverlay";
import UserContext from "../../../UserContext";
import { DAISU_STAGE_EVENT, emitCaseRevealed, emitGameResult, emitJarTaken, emitPoked } from "./tourEvents";
import { tourState } from "./tourStore";

const saveTour = vi.fn();
vi.mock("../../../services/daisu/DaisuService", () => ({
  saveTour: (...args: unknown[]) => saveTour(...args),
}));

const visitMission = vi.fn();
vi.mock("../../../services/missions/MissionService", () => ({
  visitMission: (...args: unknown[]) => visitMission(...args),
  getPendingMissions: () => Promise.resolve([]),
}));
vi.mock("../../../pages/Missions/components/missionCompleteToast", () => ({ toastMissionComplete: vi.fn() }));

vi.mock("../../../services/cases/CaseServices", () => ({
  getCases: () =>
    Promise.resolve([
      { _id: "dogs", title: "Dogs Case", image: "/dogs.webp", price: 40, category: "Animals" },
      { _id: "cats", title: "Cats Case", image: "/cats.webp", price: 90, category: "Animals" },
      { _id: "kanna", title: "Kanna Case", image: "/kanna.webp", price: 30, category: "Blue Archive" },
    ]),
}));

type Onboarding = { status: "offered" | "active" | "skipped" | "done"; step: string | null; returning?: boolean } | null;

let accounts = 0;
const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

// every render signs in a new account: the tour's store lives outside react and outlasts a render
const draw = (onboarding: Onboarding, path = "/", page: ReactNode = null, daisu = true) => {
  accounts += 1;
  return render(
    <UserContext.Provider
      value={{ userData: { id: `tour-${accounts}`, username: "Nova Star", walletBalance: 500, features: { daisu }, onboarding } } as never}
    >
      <MemoryRouter initialEntries={[path]}>
        <Where />
        {page}
        <TourOverlay />
      </MemoryRouter>
    </UserContext.Provider>
  );
};

const jar = <button data-tour="daisu-jar">jar</button>;
const where = () => screen.getByTestId("where").textContent;
const stages: string[] = [];
const onStage = (e: Event) => stages.push((e as CustomEvent<string>).detail);
const lastSave = () => saveTour.mock.calls[saveTour.mock.calls.length - 1]?.filter((arg: unknown) => arg !== undefined);

describe("daisu's first-login tour", () => {
  beforeEach(() => {
    saveTour.mockReset().mockResolvedValue(undefined);
    visitMission.mockReset().mockResolvedValue(undefined);
    stages.length = 0;
    window.addEventListener(DAISU_STAGE_EVENT, onStage);
  });

  afterEach(() => {
    window.removeEventListener(DAISU_STAGE_EVENT, onStage);
    vi.useRealTimers();
  });

  it("stays away from an account the server says nothing about, and from accounts outside the beta", () => {
    draw(null);
    draw({ status: "offered", step: null }, "/", null, false);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("welcomes a new account by its first name, and a no ends it for good", () => {
    draw({ status: "offered", step: null, returning: false });
    expect(screen.getByRole("dialog", { name: /a new face/i })).toBeTruthy();
    expect(screen.getByText(/nice to meet you, nova\./i)).toBeTruthy();
    expect(screen.queryByText(/a case/i)).toBeNull();

    fireEvent.click(screen.getByText(/i'll figure it out/i));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(lastSave()).toEqual(["skipped"]);
  });

  it("says hello to a player who was here before her", () => {
    draw({ status: "offered", step: null, returning: true });

    expect(screen.getByRole("dialog", { name: /hello, nova/i })).toBeTruthy();
    expect(screen.getByText(/you already know how to play/i)).toBeTruthy();
  });

  it("takes closing her welcome as a no", () => {
    draw({ status: "offered", step: null });
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(lastSave()).toEqual(["skipped"]);
  });

  it("closes her card when the tour starts and has the player open it", () => {
    draw({ status: "offered", step: null }, "/market");
    fireEvent.click(screen.getByText(/show me around/i));

    expect(stages).toContain("bubble");
    expect(screen.getByText(/click me and i'll open up/i)).toBeTruthy();
  });

  it("gives KP from the jar, then moves on to a case of each category", async () => {
    draw({ status: "active", step: "pot" }, "/market", jar);

    expect(await screen.findByText(/you'll need k₽ to play here/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^next$/i })).toBeNull();

    act(() => emitJarTaken());
    expect(screen.getByText(/the jar fills automatically/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(where()).toBe("/");
    expect(screen.getByText(/i like the dogs case/i)).toBeTruthy();
    expect(lastSave()).toEqual(["active", "case"]);
    expect(await screen.findByText("Dogs Case")).toBeTruthy();
    expect(screen.getByText("Kanna Case")).toBeTruthy();
    expect(screen.queryByText("Cats Case")).toBeNull();

    fireEvent.click(screen.getByText("Dogs Case"));
    expect(where()).toBe("/case/dogs");
  });

  it("answers pokes from her script, grants the secret at its end, and stays unclickable until the jar is taken", async () => {
    draw({ status: "active", step: "pot" }, "/", jar);
    await screen.findByText(/you'll need k₽ to play here/i);
    expect(tourState().pokeMode).toBe("script");

    act(() => emitPoked());
    expect(screen.getByText(/click on the jar, not me/i)).toBeTruthy();

    for (let i = 1; i < 35; i++) act(() => emitPoked());
    expect(screen.getByText(/click me if you like kissing men/i)).toBeTruthy();
    expect(visitMission).not.toHaveBeenCalled();

    act(() => emitPoked());
    expect(screen.getByText(/wait, really\?/i)).toBeTruthy();
    expect(visitMission).toHaveBeenCalledWith("men-kisser");
    expect(tourState().pokeMode).toBe("locked");

    act(() => emitJarTaken());
    expect(tourState().pokeMode).toBeNull();
  });

  it("waits as a chip away from the page a step needs, and takes the player back to it", () => {
    draw({ status: "active", step: "open" }, "/market");
    fireEvent.click(screen.getByText(/continue the tour/i));

    expect(where()).toBe("/");
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

    expect(screen.getByText(/an epic sakuya, first try\? lucky\. it's in your inventory now, you can keep it or sell it\./i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByRole("dialog", { name: /a game/i })).toBeTruthy();
    expect(screen.getByText(/opening cases can get expensive fast/i)).toBeTruthy();
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

  it("walks dice from its bet through its winning range to a round, and closes a few seconds after it lands", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    draw({ status: "active", step: "game" }, "/", <button data-tour="play-button">Roll</button>);

    fireEvent.click(screen.getByText("Dice"));
    expect(where()).toBe("/dice");
    expect(screen.getByText(/dice picks a number/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByText(/drag the handle to change your winning range/i)).toBeTruthy();
    expect(lastSave()).toEqual(["active", "range"]);

    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));
    expect(screen.getByText(/waiting for your play/i)).toBeTruthy();

    fireEvent.click(screen.getByText("Roll"));
    expect(screen.getByText(/i'm watching/i)).toBeTruthy();

    act(() => emitGameResult({ game: "plinko", wagered: 10, payout: 30 }));
    act(() => emitGameResult({ game: "dice", wagered: 10, payout: 0 }));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByRole("dialog", { name: /tour done/i })).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getByRole("dialog", { name: /tour done/i })).toBeTruthy();
    expect(screen.getByText(/lost\? everyone does/i)).toBeTruthy();
    expect(screen.getByText(/you can play freely, or follow the missions/i)).toBeTruthy();
    expect(lastSave()).toEqual(["done", "done"]);

    fireEvent.click(screen.getByText(/show me my missions/i));
    expect(stages[stages.length - 1]).toBe("room");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("skips the range step for a game that has none", () => {
    draw({ status: "active", step: "game" }, "/", <button data-tour="play-button">Spin</button>);

    fireEvent.click(screen.getByText("Plinko"));
    fireEvent.click(screen.getByRole("button", { name: /^next$/i }));

    expect(lastSave()).toEqual(["active", "play"]);
  });
});
