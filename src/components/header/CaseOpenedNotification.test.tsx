import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CaseOpenedNotification from "./CaseOpenedNotification";
import { BasicItem } from "../Types";

const item = { name: "Yuuma", rarity: "3", image: "y.png", case: "c1" } as unknown as BasicItem;
const user = { id: "u1", name: "tester", profilePicture: "p.png", badge: null };

const draw = (props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <CaseOpenedNotification item={item} caseImage="case.png" user={user} {...props} />
    </MemoryRouter>
  );

describe("a card in the live drop feed", () => {
  it("says how many more came out of the same opening", () => {
    draw({ others: 4 });
    expect(screen.getByText("+4")).toBeTruthy();
  });

  it("says nothing when the opening produced one item", () => {
    draw();
    expect(screen.queryByText(/^\+/)).toBeNull();
  });

  // the flip side shows the parent case, so an upgraded item would read as having
  // dropped out of it
  it("marks a drop that came from an upgrade", () => {
    const { container } = draw({ source: "upgrade" });
    expect(container.querySelector('[title="Won by upgrading"]')).toBeTruthy();
  });

  it("leaves an ordinary opening unmarked", () => {
    const { container } = draw();
    expect(container.querySelector('[title="Won by upgrading"]')).toBeNull();
  });
});
