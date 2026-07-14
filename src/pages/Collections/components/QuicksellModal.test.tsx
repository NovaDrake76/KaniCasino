import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuicksellModal from "./QuicksellModal";
import { QuicksellPreview } from "../../../services/collections/CollectionService";

const preview: QuicksellPreview = {
  caseId: "c1",
  totalItems: 5,
  totalValue: 600,
  plan: ["a", "b", "c", "d", "e"],
  lines: [
    { _id: "i1", name: "Butter Dog", image: "d.png", rarity: "1", owned: 5, sellCount: 4, unitSellValue: 75, lineValue: 300 },
    { _id: "i2", name: "Rare Cat", image: "c.png", rarity: "3", owned: 2, sellCount: 1, unitSellValue: 300, lineValue: 300 },
  ],
};

const noop = vi.fn();

describe("QuicksellModal", () => {
  it("shows a sell-count badge per line and the running total", () => {
    render(
      <QuicksellModal open preview={preview} committing={false} setOpen={noop} onConfirm={noop} />
    );
    expect(screen.getByText("×4")).toBeTruthy();
    expect(screen.getByText("×1")).toBeTruthy();
    expect(screen.getByText("Butter Dog")).toBeTruthy();
    // the confirm button names the item count
    expect(screen.getByText("Sell 5 duplicates")).toBeTruthy();
  });

  it("calls onConfirm when the destructive button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <QuicksellModal open preview={preview} committing={false} setOpen={noop} onConfirm={onConfirm} />
    );
    fireEvent.click(screen.getByText("Sell 5 duplicates"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables the confirm button when there is nothing to sell", () => {
    const empty: QuicksellPreview = { caseId: "c1", totalItems: 0, totalValue: 0, plan: [], lines: [] };
    const onConfirm = vi.fn();
    render(
      <QuicksellModal open preview={empty} committing={false} setOpen={noop} onConfirm={onConfirm} />
    );
    const btn = screen.getByText("Sell 0 duplicates").closest("button");
    expect(btn?.disabled).toBe(true);
    fireEvent.click(btn!);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText("No duplicates to sell.")).toBeTruthy();
  });
});
