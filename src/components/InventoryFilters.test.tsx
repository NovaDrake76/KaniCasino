import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import InventoryFilters from "./InventoryFilters";

type Filters = { name: string; rarity: string; sortBy: string; order: string; minQuantity?: string };

const Harness = ({ seen }: { seen: (f: Filters) => void }) => {
  const [filters, setFilters] = useState<Filters>({ name: "", rarity: "", sortBy: "newer", order: "asc" });
  seen(filters);
  return <InventoryFilters filters={filters} setFilters={setFilters} onKeyPress={vi.fn()} />;
};

describe("the inventory filters", () => {
  it("narrow to stacks of at least so many copies, sort the biggest first, and clear back to any quantity", () => {
    const last: { filters?: Filters } = {};
    render(<Harness seen={(f) => (last.filters = f)} />);

    fireEvent.change(screen.getByLabelText("Any Quantity"), { target: { value: "5" } });
    expect(last.filters?.minQuantity).toBe("5");
    expect(screen.getByRole("option", { name: "10+ Copies" })).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue("Most Recent"), { target: { value: "mostCopies" } });
    expect(last.filters?.sortBy).toBe("mostCopies");

    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));
    expect(last.filters?.minQuantity).toBe("");
  });
});
