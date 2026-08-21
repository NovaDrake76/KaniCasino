import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Roulette from "./Roulette";
import { BasicItem } from "./Types";

const items = [
  { _id: "1", name: "Yuuma", image: "yuuma.png", rarity: "5" },
  { _id: "2", name: "Reimu", image: "reimu.png", rarity: "2" },
] as unknown as BasicItem[];

describe("Roulette", () => {
  it("plants the winner in the reel", () => {
    const { container } = render(<Roulette items={items} openedItem={items[0]} spin={false} />);
    expect(container.querySelectorAll("img").length).toBe(50);
  });

  // a sell landing after a newer open used to clear the items mid-spin, and the empty
  // winning slot took the whole page down
  it("still renders when the winner goes missing mid-spin", () => {
    const { container } = render(<Roulette items={items} openedItem={undefined} spin />);
    expect(container.querySelectorAll("img").length).toBe(50);
  });
});
