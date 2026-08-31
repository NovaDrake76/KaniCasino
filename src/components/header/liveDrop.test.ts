import { describe, it, expect } from "vitest";
import { bestDrop, DROP_TTL_MS, freshDrops, isFreshDrop } from "./liveDrop";
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

describe("how long a drop stays on the live strip", () => {
  const at = (msAgo: number) => ({ at: Date.now() - msAgo });

  it("keeps one that has just landed", () => {
    expect(isFreshDrop(at(0))).toBe(true);
    expect(isFreshDrop(at(DROP_TTL_MS - 1000))).toBe(true);
  });

  it("drops one that is no longer live, so the strip gives its space back", () => {
    // it used to hold its 112px open on every page for the rest of the session, game
    // boards included, because the queue only ever grew
    expect(isFreshDrop(at(DROP_TTL_MS + 1000))).toBe(false);
  });

  it("treats a drop with no timestamp as stale rather than immortal", () => {
    expect(isFreshDrop({})).toBe(false);
  });

  it("empties completely once the room goes quiet", () => {
    expect(freshDrops([at(60000), at(90000)])).toHaveLength(0);
    expect(freshDrops([])).toHaveLength(0);
  });

  it("keeps the whole row while the feed is still live", () => {
    // dropping the old ones one at a time left the strip half filled: a few cards on the
    // left and a stretch of bare background to the right of them. the row is full width,
    // so it either fills or it is not there at all.
    const drops = [at(1000), at(20000), at(90000), at(600000)];
    expect(freshDrops(drops)).toHaveLength(4);
  });

  it("goes on the newest, not on each one", () => {
    expect(freshDrops([at(90000), at(1000)])).toHaveLength(0);
  });
});
