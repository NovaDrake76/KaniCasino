import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-toastify";
import OrderBook from ".";
import UserContext from "../../../UserContext";
import * as MarketService from "../../../services/market/MarketService";

vi.mock("../../../services/market/MarketService");
vi.mock("react-toastify", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const row = (id: string, name: string, over: Partial<MarketService.OrderBookRow> = {}): MarketService.OrderBookRow => ({
  item: { _id: id, name, image: `/${id}.webp`, rarity: "3", slug: null },
  bestBid: 300,
  atBest: 3,
  wanted: 7,
  buyers: 2,
  latest: "2026-10-20T10:00:00Z",
  net: 285,
  house: 75,
  gain: 210,
  ...over,
});

const book = (orders: MarketService.OrderBookRow[]) => ({ totalPages: 1, currentPage: 1, feeRate: 0.05, orders });

const draw = (userData: Record<string, unknown> | null = { id: "u1", favoriteItems: [] }) =>
  render(
    <UserContext.Provider value={{ userData, isLogged: !!userData } as never}>
      <MemoryRouter>
        <OrderBook />
      </MemoryRouter>
    </UserContext.Provider>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the buy orders tab", () => {
  it("shows each bid with what a sale into it pays next to the house", async () => {
    vi.mocked(MarketService.getOrderBook).mockResolvedValue(book([row("a", "Seija", { owned: 2 }), row("b", "Kokoro", { gain: -85, owned: 0 })]));
    draw();

    expect(await screen.findByText("Seija")).toBeTruthy();
    const seija = screen.getByText("Seija").closest("div.rounded-lg") as HTMLElement;
    expect(seija.textContent).toContain("3 at this price");
    expect(seija.textContent).toMatch(/\+K₽\s210/);
    expect(seija.textContent).toContain("You own 2");
    expect(MarketService.getOrderBook).toHaveBeenCalledWith(1, "gain");
    // a sell button only where there is something to sell
    expect(screen.getAllByRole("button", { name: "Sell now" })).toHaveLength(1);
  });

  it("sells the held copies into the bid and reloads", async () => {
    vi.mocked(MarketService.getOrderBook).mockResolvedValue(book([row("a", "Seija", { owned: 5 })]));
    vi.mocked(MarketService.sellIntoOrders).mockResolvedValue({ sold: 3, returned: 0, received: 855, itemName: "Seija" });
    draw();

    fireEvent.click(await screen.findByRole("button", { name: "Sell now" }));
    expect(screen.getByRole("dialog", { name: "Sell to a buy order" })).toBeTruthy();
    // it offers as many as the best bid takes, out of the five held
    fireEvent.click(screen.getAllByRole("button", { name: "Sell now" }).at(-1) as HTMLElement);

    await waitFor(() => expect(MarketService.sellIntoOrders).toHaveBeenCalledWith("a", 300, 3));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sold 3 for K₽855", expect.anything()));
    expect(MarketService.getOrderBook).toHaveBeenCalledTimes(2);
  });

  it("says nothing was sold when the bid went first", async () => {
    vi.mocked(MarketService.getOrderBook).mockResolvedValue(book([row("a", "Seija", { owned: 1 })]));
    vi.mocked(MarketService.sellIntoOrders).mockRejectedValue({ response: { status: 409, data: { code: "no-bid" } } });
    draw();

    fireEvent.click(await screen.findByRole("button", { name: "Sell now" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Sell now" }).at(-1) as HTMLElement);

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("That bid is gone, so nothing was sold.", expect.anything()));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets a visitor read the bids without anything to sell", async () => {
    vi.mocked(MarketService.getOrderBook).mockResolvedValue(book([row("a", "Seija")]));
    draw(null);

    expect(await screen.findByText("Seija")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sell now" })).toBeNull();
    expect(screen.queryByText(/You own/)).toBeNull();
  });

  it("asks again sorted by the highest bid", async () => {
    vi.mocked(MarketService.getOrderBook).mockResolvedValue(book([row("a", "Seija")]));
    draw();
    await screen.findByText("Seija");

    fireEvent.click(screen.getByRole("button", { name: "Highest bid" }));

    await waitFor(() => expect(MarketService.getOrderBook).toHaveBeenLastCalledWith(1, "bid"));
  });
});
