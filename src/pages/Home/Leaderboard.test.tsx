import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Leaderboard from "./Leaderboard";

const getTopPlayers = vi.fn();
vi.mock("../../services/users/UserServices", () => ({
  getTopPlayers: () => getTopPlayers(),
}));

const player = (n: number) => ({
  _id: `id-${n}`,
  username: `player-${n}`,
  level: n,
  profilePicture: "",
  weeklyWinnings: n * 100,
});

const show = () => render(<MemoryRouter><Leaderboard /></MemoryRouter>);

beforeEach(() => getTopPlayers.mockReset());

describe("the podium", () => {
  // it reads users[0..2], so any count under three used to throw and blank the home page
  it.each([0, 1, 2])("survives a leaderboard of %i players", async (n) => {
    getTopPlayers.mockResolvedValue(Array.from({ length: n }, (_, i) => player(i)));

    show();

    await waitFor(() => expect(getTopPlayers).toHaveBeenCalled());
    expect(screen.getByText("Rank")).toBeTruthy();
  });

  it("shows the top three once there are enough", async () => {
    getTopPlayers.mockResolvedValue([player(0), player(1), player(2)]);

    show();

    await waitFor(() => expect(screen.getByText("player-0")).toBeTruthy());
    expect(screen.getByText("player-1")).toBeTruthy();
    expect(screen.getByText("player-2")).toBeTruthy();
  });

});
