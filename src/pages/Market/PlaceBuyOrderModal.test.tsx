import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PlaceBuyOrderModal from "./PlaceBuyOrderModal";

const placeBuyOrder = vi.fn();
vi.mock("../../services/market/MarketService", () => ({
  placeBuyOrder: (...args: unknown[]) => placeBuyOrder(...args),
}));

const item = { _id: "i1", name: "Reimu", image: "/reimu.webp" };
const open = () => render(<PlaceBuyOrderModal isOpen onClose={vi.fn()} item={item} />);
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("PlaceBuyOrderModal", () => {
  beforeEach(() => {
    placeBuyOrder.mockReset();
    placeBuyOrder.mockResolvedValue({ filled: 0 });
  });

  it("lets the quantity be cleared and retyped", async () => {
    open();
    const quantity = field("Quantity");
    await userEvent.type(quantity, "{backspace}2");
    expect(quantity.value).toBe("2");
  });

  it("puts a quantity out of range back inside it when the field is left", async () => {
    open();
    const quantity = field("Quantity");
    await userEvent.clear(quantity);
    await userEvent.type(quantity, "50");
    await userEvent.tab();
    expect(quantity.value).toBe("20");
    await userEvent.clear(quantity);
    await userEvent.tab();
    expect(quantity.value).toBe("1");
  });

  it("sends what was typed", async () => {
    open();
    await userEvent.type(field("Price each"), "150");
    await userEvent.type(field("Quantity"), "{backspace}3");
    await userEvent.click(screen.getByRole("button", { name: "Place buy order" }));
    expect(placeBuyOrder).toHaveBeenCalledWith("i1", 150, 3);
  });
});
