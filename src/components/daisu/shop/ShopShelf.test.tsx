import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ShopShelf from "./ShopShelf";
import BuyCard from "./BuyCard";
import type { Shop, ShopItem } from "../../../services/daisu/ShopService";

const item = (over: Partial<ShopItem>): ShopItem => ({ key: "collectionBook", kind: "unlock", price: 5000, level: 5, owned: false, via: null, ...over });

const shop = (level: number, items: ShopItem[], hidden = 4, boostHidden = 0): Shop => ({
  level, walletBalance: 6240, items, hidden: { unlock: hidden, boost: boostHidden }, xpBoost: { all: 1 },
});

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
    expect(screen.getByRole("button", { name: /trader's license/i }).getAttribute("aria-label")).toMatch(/kept from your trading history/i);
    expect(screen.getByRole("button", { name: /prediction pass/i }).textContent).toMatch(/needs level 15 · you are level 6/i);
    expect(screen.getAllByText("???")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: /prediction pass/i }));
    expect(onPick).toHaveBeenCalledWith("predictionPass");
  });

  it("puts what is held in a strip with the xp bonus it adds up to, and the boosts and charms in rows of their own", () => {
    render(
      <ShopShelf
        shop={{
          level: 12,
          walletBalance: 50000,
          xpBoost: { all: 1.15, dice: 0.25 },
          hidden: { unlock: 6, boost: 17 },
          items: [
            item({ key: "luckyPencil", kind: "boost", price: 300, level: 2, xp: 0.05, owned: true, via: "bought" }),
            item({ key: "readingLamp", kind: "boost", price: 2000, level: 6, xp: 0.1, owned: true, via: "bought" }),
            item({ key: "coffeeMug", kind: "boost", price: 4000, level: 8, xp: 0.1 }),
            item({ key: "diceCharm", kind: "charm", price: 5000, level: 10, xp: 0.25, game: "dice", owned: true, via: "bought" }),
            item({ key: "crashCharm", kind: "charm", price: 5000, level: 10, xp: 0.25, game: "crash" }),
            item({ key: "chatPass", price: 1000, level: 10 }),
          ],
        }}
        onPick={vi.fn()}
      />
    );

    expect(screen.getByText("Your items · 3")).toBeTruthy();
    expect(screen.getByText("+15% XP")).toBeTruthy();
    expect(screen.getByRole("button", { name: /lucky pencil/i }).getAttribute("data-state")).toBe("owned");
    expect(screen.getByRole("button", { name: /coffee mug/i }).getAttribute("data-state")).toBe("open");
    expect(screen.getByText(/\+25% XP on every Crash bet/i)).toBeTruthy();
    expect(screen.getByText("Boosts")).toBeTruthy();
    expect(screen.getByText("Charms")).toBeTruthy();
    // two ladders tease, the charms never do
    expect(screen.getAllByText("???")).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: /show names/i }));
    // the name on the strip and in its tooltip
    expect(screen.getAllByText("Lucky Pencil")).toHaveLength(2);
  });

  it("stands a ? in for the items still hidden, two at most, and none once everything is on the shelf", () => {
    const { unmount } = render(<ShopShelf shop={shop(6, [item({})], 1)} onPick={vi.fn()} />);
    expect(screen.getAllByText("???")).toHaveLength(1);
    unmount();

    render(<ShopShelf shop={shop(6, [item({})], 0)} onPick={vi.fn()} />);
    expect(screen.queryByText("???")).toBeNull();
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
