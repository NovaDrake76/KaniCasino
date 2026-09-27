import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import MyListings from ".";
import * as MarketService from "../../../services/market/MarketService";

vi.mock("../../../services/market/MarketService");
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const listing = (uniqueId: string, itemName: string, price: number) => ({
  _id: `l-${uniqueId}`,
  item: `i-${uniqueId}`,
  uniqueId,
  price,
  itemName,
  itemImage: `/${uniqueId}.webp`,
  rarity: "3",
  createdAt: "2026-09-27T10:00:00Z",
});

const page = (listings: ReturnType<typeof listing>[]) => ({ total: listings.length, totalPages: 1, currentPage: 1, listings });

const draw = (onChanged = vi.fn()) =>
  render(
    <MemoryRouter>
      <MyListings onChanged={onChanged} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("my listings on the market", () => {
  it("shows what the player has up for sale, at their price", async () => {
    vi.mocked(MarketService.getMyListings).mockResolvedValue(page([listing("a", "Otter", 150), listing("b", "Capybara", 90)]));
    draw();

    expect(await screen.findByText("Otter")).toBeTruthy();
    expect(screen.getByText("Capybara")).toBeTruthy();
    expect(screen.getByText("2 items listed")).toBeTruthy();
    expect(screen.getByText("Otter").closest("div.rounded-xl")?.textContent).toContain("150");
  });

  it("takes a listing down, tells the player, and reloads", async () => {
    const onChanged = vi.fn();
    vi.mocked(MarketService.getMyListings)
      .mockResolvedValueOnce(page([listing("a", "Otter", 150), listing("b", "Capybara", 90)]))
      .mockResolvedValueOnce(page([listing("b", "Capybara", 90)]));
    vi.mocked(MarketService.removeListing).mockResolvedValue({ message: "Item removed" });
    draw(onChanged);

    fireEvent.click((await screen.findAllByRole("button", { name: "Remove" }))[0]);

    await waitFor(() => expect(screen.queryByText("Otter")).toBeNull());
    expect(MarketService.removeListing).toHaveBeenCalledWith("a");
    expect(toast.success).toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it("says so when nothing is listed", async () => {
    vi.mocked(MarketService.getMyListings).mockResolvedValue(page([]));
    draw();

    expect(await screen.findByText(/nothing listed for sale/i)).toBeTruthy();
  });
});
