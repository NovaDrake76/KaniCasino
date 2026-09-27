import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UserContext from "../UserContext";
import Item from "./Item";
import * as UserServices from "../services/users/UserServices";

vi.mock("../services/users/UserServices");
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const stack = { _id: "otter", name: "Otter", image: "/otter.webp", rarity: "3", uniqueId: "u1", sellValue: 75, quantity: 4 };

const draw = (favoriteItems: string[], toogleUserData = vi.fn()) =>
  render(
    <UserContext.Provider value={{ userData: { id: "me", walletBalance: 0, favoriteItems }, toogleUserData } as never}>
      <MemoryRouter>
        <Item item={stack} fixable sellable />
      </MemoryRouter>
    </UserContext.Provider>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a favorite on the inventory card", () => {
  it("is marked from the card, for the whole item", async () => {
    vi.mocked(UserServices.setFavorite).mockResolvedValue({ favoriteItems: ["otter"] });
    const toogleUserData = vi.fn();
    draw([], toogleUserData);

    fireEvent.click(screen.getByRole("button", { name: /can't be sold or upgraded/i }));

    await waitFor(() => expect(toogleUserData).toHaveBeenCalledWith(expect.objectContaining({ favoriteItems: ["otter"] })));
    expect(UserServices.setFavorite).toHaveBeenCalledWith("otter", true);
  });

  // a favorite is locked: nothing sells it until it is unfavorited, and the card says so where the sell buttons were
  it("offers no sell at all, says why, and can be unmarked", () => {
    draw(["otter"]);

    expect(screen.queryByRole("button", { name: /^sell/i })).toBeNull();
    expect(screen.getByText(/unfavorite it to sell or upgrade it/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /remove from favorites/i }).getAttribute("aria-pressed")).toBe("true");
  });
});
