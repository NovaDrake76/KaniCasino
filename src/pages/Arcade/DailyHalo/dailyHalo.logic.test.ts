import { describe, it, expect, beforeEach } from "vitest";
import {
  academyLogo,
  clearGuestGuesses,
  countdown,
  MATCH_KEYS,
  readGuestGuesses,
  searchStudents,
  shareText,
  winRate,
  writeGuestGuesses,
} from "./dailyHalo.logic";
import type { GuessRow, HaloStudent, MatchStatus } from "../../../services/arcade/DailyHaloService";
import { haloStatus } from "../ArcadeHome/ArcadeHome.services";

const student = (name: string, academy = "Trinity"): HaloStudent => ({
  name,
  rarity: 2,
  type: "Striker",
  role: "Dealer",
  attackType: "Explosive",
  defenseType: "Light",
  academy,
  schoolYear: "2nd Year",
  age: "16",
  height: 155,
  studentImage: "p.webp",
});

const row = (status: MatchStatus, correct = false): GuessRow => ({
  student: student("X"),
  correct,
  matches: Object.fromEntries(MATCH_KEYS.map((k) => [k, status])) as GuessRow["matches"],
});

describe("finding a student to guess", () => {
  const pool = [student("Hoshino"), student("Shiroko"), student("Shigure"), student("Hanako")];

  it("puts names that start with the text above names that only contain it", () => {
    expect(searchStudents(pool, "shi", new Set()).map((s) => s.name)).toEqual(["Shigure", "Shiroko", "Hoshino"]);
  });

  it("leaves out anyone already guessed and shows nothing for an empty box", () => {
    expect(searchStudents(pool, "shi", new Set(["Shiroko"])).map((s) => s.name)).toEqual(["Shigure", "Hoshino"]);
    expect(searchStudents(pool, "   ", new Set())).toEqual([]);
  });
});

describe("a guest's game in the browser", () => {
  beforeEach(() => window.localStorage.clear());

  it("comes back for the same day and is ignored on the next", () => {
    writeGuestGuesses(200, ["Hoshino"]);
    expect(readGuestGuesses(200)).toEqual(["Hoshino"]);
    expect(readGuestGuesses(201)).toEqual([]);
    clearGuestGuesses();
    expect(readGuestGuesses(200)).toEqual([]);
  });

  it("survives something unreadable in storage", () => {
    window.localStorage.setItem("kani.dailyHalo", "{not json");
    expect(readGuestGuesses(200)).toEqual([]);
  });
});

describe("sharing a result", () => {
  it("shows the score and one line of squares per guess, oldest first, without the answer", () => {
    const text = shareText(12, [row("WRONG"), row("HIGHER"), row("CORRECT", true)], true, 10, "https://kanicasino.com/arcade/daily-halo");
    const lines = text.split("\n");
    expect(lines[0]).toBe("Daily Halo #12 3/10");
    expect(lines[1]).toBe("\u{1F7E5}".repeat(9));
    expect(lines[2]).toBe("\u{1F7E8}".repeat(9));
    expect(lines[3]).toBe("\u{1F7E9}".repeat(9));
    expect(lines[4]).toBe("https://kanicasino.com/arcade/daily-halo");
  });

  it("marks a lost game with an X", () => {
    expect(shareText(3, [row("WRONG")], false, 10, "u").split("\n")[0]).toBe("Daily Halo #3 X/10");
  });
});

describe("small pieces", () => {
  it("counts down in hours, minutes and seconds and never below zero", () => {
    expect(countdown(3_723_000)).toBe("01:02:03");
    expect(countdown(-5)).toBe("00:00:00");
  });

  it("knows an academy logo and has none for the rest", () => {
    expect(academyLogo("Red Winter")).toBe("/images/arcade/academies/Red_Winter_Icon.webp");
    expect(academyLogo("Other")).toBeNull();
  });

  it("works out a win rate and handles a player with no games", () => {
    expect(winRate({ played: 8, wins: 6, currentStreak: 0, bestStreak: 0, distribution: [] })).toBe(75);
    expect(winRate(null)).toBe(0);
  });

  it("labels the arcade card from today's game", () => {
    expect(haloStatus(null)).toBe("new");
    const base = { guesses: [row("WRONG")], won: false, lost: false, finished: false, hints: [], answer: null, reward: 0, adopted: false };
    expect(haloStatus({ play: base } as never)).toBe("playing");
    expect(haloStatus({ play: { ...base, won: true, finished: true } } as never)).toBe("solved");
    expect(haloStatus({ play: { ...base, lost: true, finished: true } } as never)).toBe("missed");
  });
});
