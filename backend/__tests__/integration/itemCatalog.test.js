const { setupDb, clearDb, teardownDb } = require("./db");
const Item = require("../../models/Item");
const itemCatalog = require("../../utils/itemCatalog");
const { recomputeCaseValues } = require("../../utils/itemValue");
const Case = require("../../models/Case");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

const makeItem = (name, rarity = "3") => Item.create({ name, image: `${name}.png`, rarity, baseValue: 100 });

describe("the cached item catalog", () => {
  it("serves the catalog and picks up a new item", async () => {
    await makeItem("Yuuma");
    expect((await itemCatalog.all()).map((i) => i.name)).toEqual(["Yuuma"]);

    await makeItem("Momiji");
    expect((await itemCatalog.all()).map((i) => i.name).sort()).toEqual(["Momiji", "Yuuma"]);
  });

  it("picks up an edit and a deletion", async () => {
    const item = await makeItem("Yuuma");
    await itemCatalog.all();

    await Item.findByIdAndUpdate(item._id, { name: "Renamed" });
    expect((await itemCatalog.all()).map((i) => i.name)).toEqual(["Renamed"]);

    await Item.findByIdAndDelete(item._id);
    expect(await itemCatalog.all()).toEqual([]);
  });

  it("picks up a bulkWrite, which fires no model hook", async () => {
    const item = await makeItem("Yuuma", "5");
    const box = await Case.create({ title: "c", image: "x", price: 10, items: [item._id] });
    await itemCatalog.all();

    await recomputeCaseValues(box._id);

    const [fresh] = await itemCatalog.all();
    expect(fresh.baseValue).toBe((await Item.findById(item._id)).baseValue);
  });

  it("filters by a case-insensitive part of the name, by rarity and by case", async () => {
    const a = await makeItem("Yuuma", "3");
    await makeItem("Momiji", "5");

    expect((await itemCatalog.find({ name: "yuu" })).map((i) => i.name)).toEqual(["Yuuma"]);
    expect((await itemCatalog.find({ name: "UMA" })).map((i) => i.name)).toEqual(["Yuuma"]);
    expect((await itemCatalog.find({ rarity: "5" })).map((i) => i.name)).toEqual(["Momiji"]);
    expect(await itemCatalog.find({ caseId: String(a.case || "none") })).toEqual([]);
    expect(await itemCatalog.find({ name: "nobody" })).toEqual([]);
  });

  it("maps every id to its character, and rebuilds the map when the catalog turns over", async () => {
    const item = await makeItem("Yuuma");
    expect((await itemCatalog.namesById()).get(String(item._id))).toBe("Yuuma");

    await Item.findByIdAndUpdate(item._id, { name: "Renamed" });
    expect((await itemCatalog.namesById()).get(String(item._id))).toBe("Renamed");
  });

  it("sends one query when several callers ask a cold cache at once", async () => {
    await makeItem("Yuuma");
    itemCatalog.invalidate();
    const spy = jest.spyOn(Item, "find");

    await Promise.all([itemCatalog.all(), itemCatalog.all(), itemCatalog.all(), itemCatalog.all()]);

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
