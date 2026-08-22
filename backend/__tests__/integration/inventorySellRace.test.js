process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const { sellUniqueIds } = require("../../utils/inventorySell");
const { sellValue } = require("../../utils/itemValue");

beforeAll(setupDb);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDb();
});
afterAll(teardownDb);

const itemId = new mongoose.Types.ObjectId();
const BASE = 100;

async function scenario(uniqueIds) {
  await Item.create({ _id: itemId, name: "Keine", image: "k.png", rarity: "1", baseValue: BASE });
  const s = uniqueSuffix();
  return User.create({
    username: `u-${s}`,
    email: `u-${s}@example.com`,
    password: "x",
    walletBalance: 0,
    inventory: uniqueIds.map((uniqueId) => ({ _id: itemId, uniqueId, name: "Keine", rarity: "1" })),
  });
}

const heldBy = async (id) => (await User.findById(id).select("inventory")).inventory.map((e) => e.uniqueId).sort();

describe("selling copies", () => {
  it("takes exactly the copies asked for and pays for exactly those", async () => {
    const user = await scenario(["a", "b", "c"]);
    const res = await sellUniqueIds(user._id, ["a", "b"]);

    expect(res.sold).toBe(2);
    expect(res.value).toBe(sellValue(BASE) * 2);
    expect(res.walletBalance).toBe(sellValue(BASE) * 2);
    expect(await heldBy(user._id)).toEqual(["c"]);
  });

  it("ignores an id the player does not hold, and pays for none of it", async () => {
    const user = await scenario(["a"]);
    const res = await sellUniqueIds(user._id, ["a", "ghost"]);

    expect(res.sold).toBe(1);
    expect(res.value).toBe(sellValue(BASE));
    expect(await heldBy(user._id)).toEqual([]);
  });

  it("sells nothing and pays nothing when none of the copies are there", async () => {
    const user = await scenario(["a"]);
    const res = await sellUniqueIds(user._id, ["ghost"]);

    expect(res).toEqual({ sold: 0, value: 0, walletBalance: 0, removed: [] });
    expect(await heldBy(user._id)).toEqual(["a"]);
  });

  it("has nothing to say about a user who is gone", async () => {
    expect(await sellUniqueIds(new mongoose.Types.ObjectId(), ["a"])).toBeNull();
  });
});

// the write is all-or-nothing against the copies just read, so a copy that moves in
// between costs the attempt rather than the accounting
describe("a copy taken mid-sell", () => {
  it("credits only for what it actually removed", async () => {
    const user = await scenario(["a", "b", "c"]);

    const real = User.aggregate.bind(User);
    jest.spyOn(User, "aggregate").mockImplementationOnce(async (pipeline) => {
      const rows = await real(pipeline);
      await User.updateOne({ _id: user._id }, { $pull: { inventory: { uniqueId: "c" } } });
      return rows;
    });

    const res = await sellUniqueIds(user._id, ["a", "b", "c"]);

    expect(res.sold).toBe(2);
    expect(res.value).toBe(sellValue(BASE) * 2);
    expect(res.walletBalance).toBe(sellValue(BASE) * 2);
    expect(await heldBy(user._id)).toEqual([]);
  });

  it("leaves the balance alone when every attempt loses the race", async () => {
    const user = await scenario(["a", "b"]);

    const real = User.aggregate.bind(User);
    jest.spyOn(User, "aggregate").mockImplementation(async (pipeline) => {
      const rows = await real(pipeline);
      await User.updateOne({ _id: user._id }, { $push: { inventory: { _id: itemId, uniqueId: `x-${Math.random()}` } } });
      await User.updateOne({ _id: user._id }, { $pull: { inventory: { uniqueId: rows[0] && rows[0].uniqueId } } });
      return rows;
    });

    const res = await sellUniqueIds(user._id, ["a", "b"]);

    expect(res.sold).toBe(0);
    expect(res.value).toBe(0);
    expect((await User.findById(user._id).select("walletBalance")).walletBalance).toBe(0);
  });
});
