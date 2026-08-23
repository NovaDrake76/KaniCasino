import { describe, it, expect } from "vitest";
import { bestDrop } from "./liveDrop";
import { BasicItem } from "../Types";

const item = (name: string, rarity: string) => ({ name, rarity, image: `${name}.png` }) as BasicItem;

// the feed used to draw items[0], so a five-open threw away four items and usually showed
// the dullest one. it draws the rarest now, with a count for the rest.
describe("picking what a multi-open shows", () => {
  it("takes the rarest of the batch", () => {
    const items = [item("common", "1"), item("gold", "5"), item("blue", "2")];
    expect(bestDrop(items)?.name).toBe("gold");
  });

  it("keeps the first rolled when two are equally rare", () => {
    expect(bestDrop([item("first", "4"), item("second", "4")])?.name).toBe("first");
  });

  it("compares rarity as a number, not as text", () => {
    // "10" sorts before "9" as a string, and the feed would show the wrong one
    expect(bestDrop([item("nine", "9"), item("ten", "10")])?.name).toBe("ten");
  });

  it("handles a single item and an empty batch", () => {
    expect(bestDrop([item("only", "3")])?.name).toBe("only");
    expect(bestDrop([])).toBeUndefined();
  });
});
