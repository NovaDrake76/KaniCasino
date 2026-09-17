import type { GuessRow, HaloStats, HaloStudent, MatchKey, MatchStatus } from "../../../services/arcade/DailyHaloService";

// the order the row reads in, and the order the shared result reads in
export const MATCH_KEYS: MatchKey[] = [
  "academy",
  "role",
  "type",
  "rarity",
  "attackType",
  "defenseType",
  "height",
  "age",
  "schoolYear",
];

const GUEST_KEY = "kani.dailyHalo";

// a guest's names for one site day. yesterday's list is simply ignored, so nothing needs
// clearing when the student changes.
export const readGuestGuesses = (day: number): string[] => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(GUEST_KEY) || "null");
    return stored && stored.day === day && Array.isArray(stored.guesses) ? stored.guesses : [];
  } catch {
    return [];
  }
};

export const writeGuestGuesses = (day: number, guesses: string[]) => {
  try {
    window.localStorage.setItem(GUEST_KEY, JSON.stringify({ day, guesses }));
  } catch {
    // storage blocked: the game still plays, it just does not survive a reload
  }
};

export const clearGuestGuesses = () => {
  try {
    window.localStorage.removeItem(GUEST_KEY);
  } catch {
    // nothing to clear
  }
};

// starts-with beats contains, so typing "shi" puts Shiroko above Hoshino
export const searchStudents = (pool: HaloStudent[], term: string, guessed: Set<string>, limit = 8): HaloStudent[] => {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  return pool
    .filter((s) => !guessed.has(s.name) && s.name.toLowerCase().includes(needle))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
};

const ACADEMY_LOGOS: Record<string, string> = {
  Abydos: "Abydos_Icon",
  Arius: "ARIUS_Icon",
  Gehenna: "Gehenna_Icon",
  Highlander: "Highlander_Icon",
  Hyakkiyako: "Hyakkiyako_Icon",
  Millennium: "Millennium_Icon",
  "Red Winter": "Red_Winter_Icon",
  SRT: "SRT_Icon",
  Shanhaijing: "Shanhaijing_Icon",
  Trinity: "Trinity_Icon",
  Valkyrie: "Valkyrie_Icon",
  "Wild Hunt": "Wildhunt_Icon",
};

export const academyLogo = (academy: string): string | null =>
  ACADEMY_LOGOS[academy] ? `/images/arcade/academies/${ACADEMY_LOGOS[academy]}.webp` : null;

export const countdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const SQUARE: Record<MatchStatus, string> = {
  CORRECT: "\u{1F7E9}",
  HIGHER: "\u{1F7E8}",
  LOWER: "\u{1F7E8}",
  WRONG: "\u{1F7E5}",
};

// the result without the answer: one line of squares per guess, oldest first, the way a
// friend would read the attempt back
export const shareText = (number: number, rows: GuessRow[], won: boolean, maxGuesses: number, url: string) => {
  const score = won ? `${rows.length}/${maxGuesses}` : `X/${maxGuesses}`;
  const lines = rows.map((row) => MATCH_KEYS.map((k) => SQUARE[row.matches[k]]).join(""));
  return [`Daily Halo #${number} ${score}`, ...lines, url].join("\n");
};

export const winRate = (stats: HaloStats | null) =>
  stats && stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
