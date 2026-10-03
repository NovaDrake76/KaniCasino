process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const FanBoard = require("../../models/FanBoard");
const fandom = require("../../utils/fandom");

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const makeItem = (name) => Item.create({ name, image: `${name}.png`, rarity: "3", baseValue: 100 });
const makeCase = (title, items) =>
  Case.create({ title, image: `${title}.png`, price: 10, items: items.map((i) => i._id), category: "Touhou", slug: title.toLowerCase() });

describe("the copies of the public reads", () => {
  it("serves the case list from its copy until a case is written", async () => {
    const reimu = await makeItem("Reimu");
    const box = await makeCase("Shrine", [reimu]);
    expect((await request(app).get("/cases")).body.map((c) => c.title)).toEqual(["Shrine"]);

    // a write this process did not make is not seen until the copy expires
    await Case.collection.updateOne({ _id: box._id }, { $set: { title: "Moved" } });
    expect((await request(app).get("/cases")).body.map((c) => c.title)).toEqual(["Shrine"]);

    // a write through the model forgets the copy at once
    await Case.findByIdAndUpdate(box._id, { title: "Hakurei Shrine" });
    expect((await request(app).get("/cases")).body.map((c) => c.title)).toEqual(["Hakurei Shrine"]);
  });

  it("shows a renamed item on the case page at once", async () => {
    const marisa = await makeItem("Marisa");
    await makeCase("Forest", [marisa]);
    expect((await request(app).get("/cases/forest")).body.items[0].name).toBe("Marisa");

    await Item.updateOne({ _id: marisa._id }, { $set: { name: "Marisa Kirisame" } });
    expect((await request(app).get("/cases/forest")).body.items[0].name).toBe("Marisa Kirisame");
  });

  it("does not hand a search somebody else's copy of the full list", async () => {
    const a = await makeItem("A");
    await makeCase("Lunatic", [a]);
    await makeCase("Easy", [a]);
    await request(app).get("/cases");

    const res = await request(app).get("/cases?q=luna");
    expect(res.body.map((c) => c.title)).toEqual(["Lunatic"]);
  });

  it("shows a rebuilt board as soon as the sweep has written it", async () => {
    const yuuma = await makeItem("Yuuma");
    const s = uniqueSuffix();
    await User.create({
      username: `fan-${s}`,
      email: `fan-${s}@example.com`,
      password: "x",
      inventory: [{ _id: yuuma._id, rarity: "3" }],
      fixedItem: { name: "Yuuma", image: "Yuuma.png", rarity: "3", description: "" },
    });
    expect((await request(app).get("/fandom/collectors")).body.ranks).toEqual([]);

    await fandom.rebuild();

    expect((await request(app).get("/fandom/collectors")).body.ranks).toHaveLength(1);
    expect((await request(app).get("/fandom")).body.boards.map((b) => b.name)).toContain("Yuuma");
  });

  it("keeps a picture inlined as data off the boards", async () => {
    const yuuma = await makeItem("Yuuma");
    const s = uniqueSuffix();
    await User.create({
      username: `old-${s}`,
      email: `old-${s}@example.com`,
      password: "x",
      profilePicture: `data:image/png;base64,${"A".repeat(40000)}`,
      inventory: [{ _id: yuuma._id, rarity: "3" }],
      fixedItem: { name: "Yuuma", image: "Yuuma.png", rarity: "3", description: "" },
    });

    await fandom.rebuild();

    const board = await FanBoard.findOne({ name: "Yuuma" }).lean();
    expect(board.top.profilePicture).toBeNull();
    const collectors = await request(app).get("/fandom/collectors");
    expect(collectors.body.ranks[0].profilePicture).toBeNull();
    expect(JSON.stringify(collectors.body).length).toBeLessThan(2000);
  });
});
