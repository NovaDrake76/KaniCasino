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
  lastResult: null,
  dismissResult: () => undefined,
  points: [],
  showPoints: false,
  openPoints: () => undefined,
  closePoints: () => undefined,
  ...over,
});

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
});
