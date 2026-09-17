import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ShopPanel from "./ShopPanel";
import BuyCard from "./BuyCard";
import type { Shop, ShopItem } from "../../../services/daisu/ShopService";

const item = (over: Partial<ShopItem>): ShopItem => ({ key: "collectionBook", price: 5000, level: 5, owned: false, via: null, ...over });

const shop = (level: number, items: ShopItem[]): Shop => ({ level, walletBalance: 6240, items });

describe("her shop", () => {
  it("sells what the player can buy, shows what they own and how, and keeps a high level shut", () => {
    const onPick = vi.fn();
    render(
      <ShopPanel
        shop={shop(6, [
          item({ key: "collectionBook" }),
          item({ key: "tradersLicense", price: 2500, owned: true, via: "history" }),
          item({ key: "predictionPass", level: 15 }),
        ])}
        onPick={onPick}
      />
    );

    expect(screen.getByText("Collection Book")).toBeTruthy();
    expect(screen.getByText("Yours")).toBeTruthy();
    expect(screen.getByText(/kept from your trading history/i)).toBeTruthy();
    expect(screen.getByText("Level 15")).toBeTruthy();
    expect(screen.getByText("Locked")).toBeTruthy();

    const buttons = screen.getAllByRole("button", { name: "Buy" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onPick).toHaveBeenCalledWith("collectionBook");
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
