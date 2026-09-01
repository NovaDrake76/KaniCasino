import { describe, it, expect } from "vitest";
import { KEEP_DROPS, bestDrop, pushDrop } from "./liveDrop";
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

describe("what takes a drop off the strip", () => {
  const drops = (n: number) => Array.from({ length: n }, (_, i) => `d${i}`);

  it("keeps what is there when nobody is opening anything", () => {
    // nothing but a newer drop removes one. the strip used to empty itself after a quiet
    // spell, so a bar full of items went blank while the player was looking at it.
    const bar = drops(6);
    expect(pushDrop(bar, "new")).toEqual(["new", ...bar]);
    expect(pushDrop(bar, "new")).toHaveLength(7);
  });

  it("puts the newest at the front", () => {
    expect(pushDrop(["b", "c"], "a")[0]).toBe("a");
  });

  it("drops the oldest only once the bar is full", () => {
    const full = drops(KEEP_DROPS);
    const after = pushDrop(full, "new");

    expect(after).toHaveLength(KEEP_DROPS);
    expect(after[0]).toBe("new");
    expect(after).not.toContain(`d${KEEP_DROPS - 1}`);
  });

  it("fills from empty as openings arrive, which is how a fresh page starts", () => {
    let bar: string[] = [];
    for (const d of ["a", "b", "c"]) bar = pushDrop(bar, d);
    expect(bar).toEqual(["c", "b", "a"]);
  });

  it("never grows past the cap however many arrive", () => {
    let bar: string[] = [];
    for (let i = 0; i < KEEP_DROPS * 3; i++) bar = pushDrop(bar, `d${i}`);
    expect(bar).toHaveLength(KEEP_DROPS);
  });
});
