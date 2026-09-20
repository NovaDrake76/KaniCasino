import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Roulette from "./Roulette";
import { BasicItem } from "./Types";

const items = [
  { _id: "1", name: "Yuuma", image: "yuuma.png", rarity: "5" },
  { _id: "2", name: "Reimu", image: "reimu.png", rarity: "2" },
] as unknown as BasicItem[];

// jsdom lays nothing out, so the slot and the window it is clipped to are stated here
const layout = (slot: number, view: number) => {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: slot });
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: view });
};

const landing = (container: HTMLElement, slot: number) => {
  const tx = Number(container.querySelector("style")?.textContent?.match(/translateX\((-?[\d.]+)px\)/)?.[1]);
  return 36 * (slot + 8) + slot / 2 + tx;
};

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

  // the reel used to aim at the middle of an 1100px window whatever the screen, so on a
  // phone it stopped two slots short of the prize the server had already paid
  it.each([
    ["a phone", 328],
    ["a tablet", 756],
    ["a desktop", 1100],
  ])("stops with the winner under the marker on %s", (_name, view) => {
    layout(176, view);
    const { container } = render(<Roulette items={items} openedItem={items[0]} spin />);
    expect(Math.abs(landing(container as HTMLElement, 176) - view / 2)).toBeLessThanOrEqual(76);
  });
});
