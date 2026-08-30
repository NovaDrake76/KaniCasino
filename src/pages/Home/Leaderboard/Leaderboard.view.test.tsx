import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import LeaderboardView from "./Leaderboard.view";
import { LeaderboardViewProps } from "./Leaderboard.types";
import { BoardStanding } from "../../../services/leaderboard/LeaderboardService";

const player = (rank: number, username: string): BoardStanding => ({
  _id: `u${rank}`,
  rank,
  points: 10000 - rank * 500,
  bets: rank,
  prize: 1000 - rank * 50,
  username,
  profilePicture: "",
  level: 10,
  badge: null,
});

const standings = [
  player(1, "first"),
  player(2, "second"),
  player(3, "third"),
  player(4, "fourth"),
  player(5, "fifth"),
];

const props = (over: Partial<LeaderboardViewProps> = {}): LeaderboardViewProps => ({
  loading: false,
  board: null,
  podium: [standings[1], standings[0], standings[2]],
  rest: standings.slice(3),
  podiumRest: standings.slice(1, 3),
  countdown: { hours: "04", minutes: "12", seconds: "38" },
  pool: 21700,
  paidPlaces: 10,
  me: null,
  meOnBoard: false,
  points: [],
  showPoints: false,
  openPoints: () => undefined,
  closePoints: () => undefined,
  ...over,
});

// attribute match, so the arbitrary-value class needs no css escaping
const SPACER = '[class*="h-[330px]"]';

const draw = (over: Partial<LeaderboardViewProps> = {}) =>
  render(
    <MemoryRouter>
      <LeaderboardView {...props(over)} />
    </MemoryRouter>
  );

const me = { _id: "u4", points: 8000, bets: 4, rank: 4, toPaidPlace: 0, prize: 800 };

describe("the daily leaderboard", () => {
  it("does not repeat a player who is already ranked in the table", () => {
    // the pinned row used to render unconditionally, so a player inside the paid places
    // appeared twice: once under their own name and again as "You"
    draw({ me, meOnBoard: true });

    expect(screen.queryByText("You")).toBeNull();
    expect(screen.getAllByText("fourth")).toHaveLength(1);
  });

  it("pins the player when they are outside the paid places", () => {
    draw({ me: { ...me, _id: "u99", rank: 23, toPaidPlace: 2410, prize: 0 }, meOnBoard: false });

    expect(screen.getByText("You")).toBeTruthy();
  });

  it("puts second and third in the table, because the podium hides them on mobile", () => {
    const { container } = draw();

    const mobileRows = container.querySelectorAll("tr.md\\:hidden");
    expect([...mobileRows].map((r) => r.textContent)).toEqual([
      expect.stringContaining("second"),
      expect.stringContaining("third"),
    ]);
    // both copies are in the dom and the breakpoint picks one: the podium card is
    // hidden below md, the table row is hidden from md up, so they never show together
    const copies = screen.getAllByText("second");
    expect(copies).toHaveLength(2);
    expect(copies.some((n) => n.closest(".hidden.md\\:block"))).toBe(true);
    expect(copies.some((n) => n.closest("tr.md\\:hidden"))).toBe(true);
  });

  it("ranks the table rows in order under the podium", () => {
    const { container } = draw();

    const ranks = [...container.querySelectorAll("tbody tr")].map(
      (row) => row.querySelector("td")?.textContent
    );
    expect(ranks).toEqual(["#2", "#3", "#4", "#5"]);
  });

  it("holds no space open when the board has just reset", () => {
    // it reserved a 330px placeholder whenever it had fewer than three players, so a
    // freshly reset board was a screenful of nothing above an empty table
    const { container } = draw({ podium: [], rest: [], podiumRest: [], me: null });

    expect(container.querySelector(SPACER)).toBeNull();
    expect(screen.getByText(/no bets yet/i)).toBeTruthy();
  });

  it("still draws the podium with only one or two players on it", () => {
    // the old condition was >= 3, so a board with two players drew neither of them
    const two = [standings[0], standings[1]];
    const { container } = draw({ podium: [two[1], two[0]], rest: [], podiumRest: [two[1]] });

    expect(container.querySelectorAll("img[src=\"images/podium.svg\"]")).toHaveLength(2);
    expect(screen.getAllByText("first").length).toBeGreaterThan(0);
  });

  it("does not tell a player who has not bet how far they are off tenth", () => {
    draw({
      podium: [], rest: [], podiumRest: [],
      me: { _id: "u9", points: 0, bets: 0, rank: null, toPaidPlace: 1, prize: 0 },
      meOnBoard: false,
    });

    expect(screen.queryByText(/points from/i)).toBeNull();
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("keeps the placeholder while it is still loading, so the page does not jump", () => {
    const { container } = draw({ loading: true, podium: [], rest: [], podiumRest: [] });
    expect(container.querySelector(SPACER)).toBeTruthy();
  });

  it("fills the empty rows with players who have not bet, and pays them nothing", () => {
    // a board that has just reset was a header over nothing. the seats are real players,
    // but a settlement only pays a standing above zero, so none of them shows a prize.
    const seat = (rank: number, username: string) => ({
      ...player(rank, username),
      points: 0,
      prize: 0,
      placeholder: true,
    });
    const rows = [standings[0], seat(2, "idle-a"), seat(3, "idle-b"), seat(4, "idle-c")];

    const { container } = draw({
      podium: [standings[0]],
      rest: rows.slice(1),
      podiumRest: [],
      me: null,
    });

    const cells = [...container.querySelectorAll("tbody tr")].map((row) =>
      [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim())
    );
    expect(cells.map((c) => c[0])).toEqual(["#2", "#3", "#4"]);
    // no prize against a seat nobody has taken
    expect(cells.every((c) => c[3] === "-")).toBe(true);
    expect(screen.queryByText(/no bets yet/i)).toBeNull();
  });

  it("keeps a player who has not bet off the podium", () => {
    // a seat on nought standing on the first plinth would be claiming K₽10,000
    const seat = { ...player(2, "idle"), points: 0, prize: 0, placeholder: true };
    const { container } = draw({ podium: [standings[0]], rest: [seat], podiumRest: [] });

    expect(container.querySelectorAll("img[src=\"images/podium.svg\"]")).toHaveLength(1);
  });
});
