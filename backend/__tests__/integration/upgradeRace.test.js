process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Item = require("../../models/Item");
const upgradeItems = require("../../games/upgrade");

beforeAll(setupDb);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDb();
});
afterAll(teardownDb);

async function scenario() {
  const caseId = new mongoose.Types.ObjectId();
  const target = await Item.create({
    name: `t-${uniqueSuffix()}`, image: "x", rarity: "3", case: caseId, baseValue: 100,
  });
  const low = await Item.create({
    name: `l-${uniqueSuffix()}`, image: "x", rarity: "1", case: caseId, baseValue: 10,
  });
  const inventory = ["a", "b", "c"].map((uniqueId) => ({
    _id: low._id, name: low.name, image: low.image, rarity: "1", case: caseId, uniqueId,
  }));
  const user = await User.create({
    username: `u-${uniqueSuffix()}`,
    email: `u-${uniqueSuffix()}@e.com`,
    password: "x",
    inventory,
  });
  return { user, target };
}

const inventoryOf = async (id) =>
  (await User.findById(id)).inventory.map((i) => i.uniqueId).sort();

test("an item sold mid-upgrade does not take the other items with it", async () => {
  const { user, target } = await scenario();

  // the race, forced: the upgrade reads three items, and "c" is sold from under it
  // before it consumes anything
  const realFindById = User.findById.bind(User);
  jest.spyOn(User, "findById").mockImplementationOnce(async (id) => {
    const doc = await realFindById(id);
    await User.updateOne({ _id: user._id }, { $pull: { inventory: { uniqueId: "c" } } });
    return doc;
  });

  const res = await upgradeItems(user._id.toString(), ["a", "b", "c"], target._id.toString());

  expect(res.status).toBe(400);
  // a and b were never spent, so they must survive the refusal
  expect(await inventoryOf(user._id)).toEqual(["a", "b"]);
});

test("an upgrade with all items present still consumes them", async () => {
  const { user, target } = await scenario();

  const res = await upgradeItems(user._id.toString(), ["a", "b"], target._id.toString());

  expect(res.status).toBe(200);
  const left = await inventoryOf(user._id);
  expect(left).not.toContain("a");
  expect(left).not.toContain("b");
  expect(left).toContain("c");
});
