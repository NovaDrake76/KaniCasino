import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DailyHalo from "./index";
import UserContext from "../../../UserContext";
import type { HaloPlay, HaloStudent, HaloToday } from "../../../services/arcade/DailyHaloService";

const getHaloStudents = vi.fn();
const getHaloToday = vi.fn();
const checkGuestGuesses = vi.fn();
const submitHaloGuess = vi.fn();
const adoptGuestGame = vi.fn();
vi.mock("../../../services/arcade/DailyHaloService", () => ({
  getHaloStudents: (...a: unknown[]) => getHaloStudents(...a),
  getHaloToday: (...a: unknown[]) => getHaloToday(...a),
  checkGuestGuesses: (...a: unknown[]) => checkGuestGuesses(...a),
  submitHaloGuess: (...a: unknown[]) => submitHaloGuess(...a),
  adoptGuestGame: (...a: unknown[]) => adoptGuestGame(...a),
}));

const student = (name: string): HaloStudent => ({
  name,
  rarity: 2,
  type: "Striker",
  role: "Dealer",
  attackType: "Explosive",
  defenseType: "Light",
  academy: "Trinity",
  schoolYear: "2nd Year",
  age: "16",
  height: 155,
  studentImage: "p.webp",
});

const hints: HaloPlay["hints"] = [
  { key: "halo", unlockAt: 1, unlocked: false, available: true },
  { key: "hobby", unlockAt: 2, unlocked: false, available: true },
];

const emptyPlay = (over: Partial<HaloPlay> = {}): HaloPlay => ({
  guesses: [],
  won: false,
  lost: false,
  finished: false,
  hints,
  answer: null,
  reward: 0,
  adopted: false,
  ...over,
});

const today = (over: Partial<HaloToday> = {}): HaloToday => ({
  day: 300,
  number: 7,
  nextAt: new Date(Date.now() + 3_600_000).toISOString(),
  maxGuesses: 10,
  poolSize: 3,
  reward: { base: 300, perSpareGuess: 70, streakBonus: 50, streakBonusCap: 500, best: 1000 },
  plays: 0,
  solves: 4,
  averageGuesses: 3.5,
  yesterday: null,
  signedIn: false,
  play: null,
  stats: null,
  ...over,
});

const toogleUserFlow = vi.fn();

const draw = (userData: unknown = null) =>
  render(
    <UserContext.Provider value={{ userData, toogleUserData: vi.fn(), toogleUserFlow } as never}>
      <MemoryRouter>
        <DailyHalo />
      </MemoryRouter>
    </UserContext.Provider>
  );

describe("daily halo", () => {
  beforeEach(() => {
    window.localStorage.clear();
    [getHaloStudents, getHaloToday, checkGuestGuesses, submitHaloGuess, adoptGuestGame, toogleUserFlow].forEach((m) => m.mockReset());
    getHaloStudents.mockResolvedValue([student("Hoshino"), student("Shiroko"), student("Hanako")]);
    getHaloToday.mockResolvedValue(today());
    checkGuestGuesses.mockResolvedValue(emptyPlay());
  });

  it("lets a guest search and guess, and keeps the guess for a reload", async () => {
    checkGuestGuesses
      .mockResolvedValueOnce(emptyPlay())
      .mockResolvedValueOnce(
        emptyPlay({
          guesses: [
            {
              student: student("Shiroko"),
              correct: false,
              matches: { academy: "CORRECT", role: "WRONG", type: "CORRECT", rarity: "HIGHER", attackType: "WRONG", defenseType: "WRONG", height: "LOWER", age: "CORRECT", schoolYear: "WRONG" },
            },
          ],
        })
      );
    draw();

    fireEvent.change(await screen.findByLabelText("Search a student"), { target: { value: "shi" } });
    fireEvent.click(await screen.findByText("Shiroko"));

    await waitFor(() => expect(checkGuestGuesses).toHaveBeenLastCalledWith(["Shiroko"]));
    expect(JSON.parse(window.localStorage.getItem("kani.dailyHalo") || "{}")).toEqual({ day: 300, guesses: ["Shiroko"] });
    expect(await screen.findByText("9 guesses left")).toBeTruthy();
  });

  it("shows the countdown, today's solves and the locked hints", async () => {
    draw();

    expect(await screen.findByText("4 solved today")).toBeTruthy();
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeTruthy();
    expect(screen.getAllByText("After 1 misses").length).toBeGreaterThan(0);
  });

  it("asks a guest to sign in to earn KP", async () => {
    draw();

    fireEvent.click(await screen.findByText("Sign in"));
    expect(toogleUserFlow).toHaveBeenCalledWith(true);
  });

  it("carries a guest game into the account once the player signs in", async () => {
    window.localStorage.setItem("kani.dailyHalo", JSON.stringify({ day: 300, guesses: ["Hanako"] }));
    getHaloToday.mockResolvedValue(today({ signedIn: true, play: emptyPlay(), stats: { played: 0, wins: 0, currentStreak: 0, bestStreak: 0, distribution: Array(10).fill(0) } }));
    adoptGuestGame.mockResolvedValue({ adopted: true, play: emptyPlay(), stats: { played: 0, wins: 0, currentStreak: 0, bestStreak: 0, distribution: Array(10).fill(0) } });

    draw({ id: "u1", walletBalance: 0 });

    await waitFor(() => expect(adoptGuestGame).toHaveBeenCalledWith(["Hanako"]));
    expect(window.localStorage.getItem("kani.dailyHalo")).toBeNull();
  });

  it("reveals the student, the reward and the case once the game is won", async () => {
    getHaloToday.mockResolvedValue(
      today({
        signedIn: true,
        stats: { played: 1, wins: 1, currentStreak: 1, bestStreak: 1, distribution: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0] },
        play: emptyPlay({
          finished: true,
          won: true,
          reward: 930,
          hints: [],
          answer: {
            name: "Hoshino",
            academy: "Abydos",
            rarity: 3,
            type: "Striker",
            role: "Tank",
            studentImage: "h.webp",
            voiceline: "",
            haloImage: "",
            card: { itemId: "i", name: "Hoshino", image: "c.png", rarity: "5", caseId: "c1", caseSlug: "abydos", caseTitle: "Kivotos Case", caseImage: null },
          },
        }),
      })
    );

    draw({ id: "u1", walletBalance: 0 });

    expect(await screen.findByText("It's Hoshino!")).toBeTruthy();
    expect(screen.getByText("Hoshino is in the Kivotos Case").closest("a")?.getAttribute("href")).toBe("/case/abydos");
    expect(screen.getByText("Copy result")).toBeTruthy();
    expect(screen.queryByLabelText("Search a student")).toBeNull();
  });
});
