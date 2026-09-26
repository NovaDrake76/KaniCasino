import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import BattlesView from "./Battles.view";
import { groupCasesByCategory } from "../../Home/groupCases";
import type { BattlesViewProps } from "./Battles.types";

const cases = [
  { _id: "c1", title: "Touhou Case 1", image: "t1.webp", price: 25, category: "Touhou" },
  { _id: "c2", title: "Touhou Case 2", image: "t2.webp", price: 500, category: "Touhou" },
  { _id: "c3", title: "Kivotos", image: "k.webp", price: 450, category: "Blue Archive" },
];

const props = (over: Partial<BattlesViewProps> = {}): BattlesViewProps =>
  ({
    modes: ["1v1"],
    groups: groupCasesByCategory(cases),
    openCategory: null,
    openGroup: vi.fn(),
    closeGroup: vi.fn(),
    shownCases: [],
    searching: false,
    pickedIn: () => 0,
    selected: [],
    mode: "1v1",
    bakaMode: false,
    search: "",
    loadingCases: false,
    waiting: [],
    creating: false,
    entryCost: 0,
    currentSlots: 2,
    countOf: () => 0,
    addCase: vi.fn(),
    removeAt: vi.fn(),
    clearSelected: vi.fn(),
    setMode: vi.fn(),
    toggleBaka: vi.fn(),
    setSearch: vi.fn(),
    create: vi.fn(),
    openBattle: vi.fn(),
    slotsFor: () => 2,
    ...over,
  }) as unknown as BattlesViewProps;

describe("picking cases for a battle", () => {
  // a hundred cases in one grid were hard to find anything in
  it("starts on the categories, one card each, with no case on show yet", () => {
    const p = props();
    render(<BattlesView {...p} />);

    expect(screen.getByRole("button", { name: /touhou/i }).textContent).toMatch(/2 cases/);
    expect(screen.getByRole("button", { name: /blue archive/i }).textContent).toMatch(/1 case(?!s)/);
    expect(screen.queryByTitle(/add touhou case 1/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /touhou/i }));
    expect(p.openGroup).toHaveBeenCalledWith("Touhou");
  });

  it("shows an open category's cases, adds them, and goes back to every category", () => {
    const p = props({ openCategory: "Touhou", shownCases: cases.slice(0, 2), countOf: (id: string) => (id === "c2" ? 2 : 0) });
    render(<BattlesView {...p} />);

    fireEvent.click(screen.getByTitle(/add touhou case 1/i));
    expect(p.addCase).toHaveBeenCalledWith(cases[0]);
    expect(screen.getByTitle(/add touhou case 2/i).textContent).toMatch(/^2/);

    fireEvent.click(screen.getByRole("button", { name: /all categories/i }));
    expect(p.closeGroup).toHaveBeenCalled();
  });

  it("searches across every category at once", () => {
    render(<BattlesView {...props({ searching: true, search: "kiv", shownCases: [cases[2]] })} />);

    expect(screen.getByTitle(/add kivotos/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /all categories/i })).toBeNull();
  });

  it("counts on a category card how many of its cases are already picked", () => {
    render(<BattlesView {...props({ pickedIn: (category: string) => (category === "Touhou" ? 3 : 0) })} />);

    expect(screen.getByRole("button", { name: /touhou/i }).textContent).toMatch(/^3/);
  });
});
