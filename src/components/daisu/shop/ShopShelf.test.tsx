import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ShopShelf from "./ShopShelf";
import BuyCard from "./BuyCard";
import type { Shop, ShopItem } from "../../../services/daisu/ShopService";

const item = (over: Partial<ShopItem>): ShopItem => ({ key: "collectionBook", price: 5000, level: 5, owned: false, via: null, ...over });

const shop = (level: number, items: ShopItem[]): Shop => ({ level, walletBalance: 6240, items });

describe("her shop shelf", () => {
  it("keeps every item in sight with its state, teases what is to come, and opens an item's card on a click", () => {
    const onPick = vi.fn();
    render(
      <ShopShelf
        shop={shop(6, [
          item({ key: "collectionBook" }),
          item({ key: "tradersLicense", price: 2500, owned: true, via: "history" }),
          item({ key: "chatPass", price: 9000 }),
          item({ key: "predictionPass", level: 15 }),
        ])}
        onPick={onPick}
      />
    );

    const state = (name: RegExp) => screen.getByRole("button", { name }).getAttribute("data-state");
    expect(state(/collection book/i)).toBe("open");
    expect(state(/trader's license/i)).toBe("owned");
    expect(state(/chat pass/i)).toBe("short");
    expect(state(/prediction pass/i)).toBe("locked");
    expect(screen.getByRole("button", { name: /trader's license/i }).textContent).toMatch(/kept from your trading history/i);
    expect(screen.getByRole("button", { name: /prediction pass/i }).textContent).toMatch(/needs level 15 · you are level 6/i);
    expect(screen.getAllByText("???")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /prediction pass/i }));
    expect(onPick).toHaveBeenCalledWith("predictionPass");
  });

  it("asks before buying, and will not sell what the wallet cannot cover", () => {
    const onBuy = vi.fn();
    const { unmount } = render(<BuyCard item={item({})} walletBalance={6240} level={6} buying={false} onBuy={onBuy} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /buy for/i }));
    expect(onBuy).toHaveBeenCalled();
    unmount();

    render(<BuyCard item={item({})} walletBalance={1200} level={6} buying={false} onBuy={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/short/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /buy for/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
