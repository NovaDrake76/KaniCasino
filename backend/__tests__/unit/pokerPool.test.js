const {
  splitAffordable,
  safeFor,
  atRiskFor,
  atRiskAll,
  redeemable,
  redeem,
  totalValue,
} = require("../../utils/pokerPool");

const item = (uniqueId, value, stakedBy) => ({
  uniqueId,
  itemId: `i-${uniqueId}`,
  name: uniqueId,
  image: `${uniqueId}.png`,
  rarity: "4",
  value,
  stakedBy,
});

const pool = () => [item("reimu", 300, 0), item("marisa", 150, 0), item("flandre", 500, 1)];

describe("what a seat can still afford", () => {
  it("keeps everything while the chips cover it", () => {
    expect(safeFor(pool(), 0, 450).map((e) => e.uniqueId)).toEqual(["reimu", "marisa"]);
    expect(atRiskFor(pool(), 0, 450)).toEqual([]);
  });

  // descending order is the whole point: the cheap one is what you cannot afford first
  it("drops the cheap item first, never the legendary", () => {
    const { safe, risk } = splitAffordable(pool().filter((e) => e.stakedBy === 0), 400);
    expect(safe.map((e) => e.uniqueId)).toEqual(["reimu"]);
    expect(risk.map((e) => e.uniqueId)).toEqual(["marisa"]);
  });

  it("puts everything on the line when the chips are gone", () => {
    expect(atRiskFor(pool(), 0, 0).map((e) => e.uniqueId).sort()).toEqual(["marisa", "reimu"]);
    expect(safeFor(pool(), 0, 0)).toEqual([]);
  });

  it("holds the exact value", () => {
    expect(atRiskFor(pool(), 0, 300).map((e) => e.uniqueId)).toEqual(["marisa"]);
    expect(atRiskFor(pool(), 0, 450).map((e) => e.uniqueId)).toEqual([]);
  });

  // greedy means falling short of the expensive item does not endanger the cheap one:
  // 299 chips cannot redeem reimu but can still cover marisa
  it("only risks what the chips genuinely cannot reach", () => {
    expect(atRiskFor(pool(), 0, 299).map((e) => e.uniqueId)).toEqual(["reimu"]);
    expect(safeFor(pool(), 0, 299).map((e) => e.uniqueId)).toEqual(["marisa"]);
    expect(atRiskFor(pool(), 0, 149).map((e) => e.uniqueId).sort()).toEqual(["marisa", "reimu"]);
  });

  it("gathers every at-risk item on the table", () => {
    const risk = atRiskAll(pool(), { 0: 300, 1: 500 });
    expect(risk.map((e) => e.uniqueId)).toEqual(["marisa"]);
    expect(atRiskAll(pool(), { 0: 300, 1: 100 }).map((e) => e.uniqueId).sort()).toEqual([
      "flandre",
      "marisa",
    ]);
  });

  it("treats a seat with no chips entry as gone", () => {
    expect(atRiskAll(pool(), {})).toHaveLength(3);
  });
});

describe("redeeming", () => {
  it("takes your own stake first and pays the rest in kp", () => {
    const res = redeem(pool(), 0, 500);
    expect(res.items.map((e) => e.uniqueId)).toEqual(["reimu", "marisa"]);
    expect(res.kp).toBe(50);
    expect(res.remaining.map((e) => e.uniqueId)).toEqual(["flandre"]);
  });

  it("leaves behind what you can no longer afford", () => {
    const res = redeem(pool(), 0, 320);
    expect(res.items.map((e) => e.uniqueId)).toEqual(["reimu"]);
    expect(res.kp).toBe(20);
    expect(res.remaining).toHaveLength(2);
  });

  it("pays out entirely in kp when nothing is affordable", () => {
    const res = redeem(pool(), 0, 100);
    expect(res.items).toEqual([]);
    expect(res.kp).toBe(100);
  });

  // the prize: another player's item, once they can no longer cover it
  it("lets a winner take an item the other seat cannot afford", () => {
    const { open } = redeemable(pool(), 0, 800, { 0: 800, 1: 0 });
    expect(open.map((e) => e.uniqueId)).toEqual(["flandre"]);
    const res = redeem(pool(), 0, 800, ["flandre", "reimu"]);
    expect(res.items.map((e) => e.uniqueId).sort()).toEqual(["flandre", "reimu"]);
    expect(res.kp).toBe(0);
  });

  it("honours an explicit pick that skips your own item", () => {
    const res = redeem(pool(), 0, 500, ["marisa"]);
    expect(res.items.map((e) => e.uniqueId)).toEqual(["marisa"]);
    expect(res.kp).toBe(350);
  });

  it("never hands out an item twice", () => {
    const res = redeem(pool(), 0, 10000, ["reimu", "reimu", "marisa"]);
    expect(res.items.map((e) => e.uniqueId)).toEqual(["reimu", "marisa"]);
  });

  // the invariant that matters: chips spent equal the value of what left the pool
  it("spends exactly the staked value of everything it hands over", () => {
    for (const chips of [0, 149, 150, 299, 300, 451, 900, 2000]) {
      const res = redeem(pool(), 0, chips);
      expect(totalValue(res.items) + res.kp).toBe(chips);
    }
  });
});
