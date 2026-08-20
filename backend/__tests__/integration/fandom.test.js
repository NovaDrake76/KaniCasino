process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const FanBoard = require("../../models/FanBoard");
const CollectorBoard = require("../../models/CollectorBoard");
const fandom = require("../../utils/fandom");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeItem(name, rarity = "3") {
  return Item.create({ name, image: `${name}.png`, rarity, baseValue: 100 });
}

function copies(item, count) {
  return Array.from({ length: count }, () => ({
    _id: item._id,
    name: item.name,
    image: item.image,
    rarity: item.rarity,
  }));
}

async function makeUser({ pinned, inventory = [], fixedAt } = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    walletBalance: 0,
    inventory,
    fixedAt,
    fixedItem: pinned
      ? { name: pinned.name, image: pinned.image, rarity: pinned.rarity, description: "" }
      : undefined,
  });
}

describe("fan boards", () => {
  it("ranks a character by pinned holders only", async () => {
    const yuuma = await makeItem("Yuuma");
    const whale = await makeUser({ pinned: yuuma, inventory: copies(yuuma, 3) });
    const fan = await makeUser({ pinned: yuuma, inventory: copies(yuuma, 9) });

    await fandom.rebuild();

    const board = await FanBoard.findOne({ name: "Yuuma" }).lean();
    expect(board.fanCount).toBe(2);
    expect(board.topCount).toBe(9);
    expect(String(board.top.userId)).toBe(String(fan._id));
    expect(board.ranks.map((r) => String(r.userId))).toEqual([String(fan._id), String(whale._id)]);

    const stale = await User.findById(whale._id).lean();
    expect(stale.fanRank.rank).toBe(2);
    expect(stale.fanRank.name).toBe("Yuuma");
  });

  it("counts only the pinned character, however much else is held", async () => {
    const yuuma = await makeItem("Yuuma");
    const momiji = await makeItem("Momiji");
    // a whale with far more Momijis, but pinned to Yuuma: Momiji's board must ignore them
    const whale = await makeUser({
      pinned: yuuma,
      inventory: [...copies(yuuma, 2), ...copies(momiji, 400)],
    });
    const small = await makeUser({ pinned: momiji, inventory: copies(momiji, 1) });

    await fandom.rebuild();

    const board = await FanBoard.findOne({ name: "Momiji" }).lean();
    expect(board.fanCount).toBe(1);
    expect(String(board.top.userId)).toBe(String(small._id));
    expect(board.topCount).toBe(1);

    const whaleDoc = await User.findById(whale._id).lean();
    expect(whaleDoc.fanRank.name).toBe("Yuuma");
  });

  it("breaks a tie by who pinned first", async () => {
    const yuuma = await makeItem("Yuuma");
    const early = await makeUser({
      pinned: yuuma,
      inventory: copies(yuuma, 5),
      fixedAt: new Date("2024-01-01"),
    });
    await makeUser({ pinned: yuuma, inventory: copies(yuuma, 5), fixedAt: new Date("2025-01-01") });

    await fandom.rebuild();

    const board = await FanBoard.findOne({ name: "Yuuma" }).lean();
    expect(String(board.top.userId)).toBe(String(early._id));
  });

  it("gives every character a board, so an unheld one can be claimed", async () => {
    await makeItem("Yuuma");
    await makeItem("Sannyo");
    await fandom.rebuild();

    const open = await FanBoard.findOne({ name: "Sannyo" }).lean();
    expect(open.fanCount).toBe(0);
    expect(open.topCount).toBe(0);
    expect(open.top).toBeFalsy();
  });

  it("clears the badge of someone who unpins", async () => {
    const yuuma = await makeItem("Yuuma");
    const momiji = await makeItem("Momiji");
    const fan = await makeUser({ pinned: yuuma, inventory: copies(yuuma, 4) });
    await fandom.rebuild();
    expect((await User.findById(fan._id).lean()).fanRank.name).toBe("Yuuma");

    await User.updateOne({ _id: fan._id }, { $set: { "fixedItem.name": momiji.name } });
    await fandom.rebuild();

    const after = await User.findById(fan._id).lean();
    expect(after.fanRank.name).toBe("Momiji");
    expect(after.fanRank.count).toBe(0);
    expect((await FanBoard.findOne({ name: "Yuuma" }).lean()).fanCount).toBe(0);
  });

  it("ranks the collection board by distinct characters", async () => {
    const a = await makeItem("Yuuma");
    const b = await makeItem("Momiji");
    const c = await makeItem("Sannyo");
    const broad = await makeUser({ inventory: [...copies(a, 1), ...copies(b, 1), ...copies(c, 1)] });
    const deep = await makeUser({ inventory: copies(a, 50) });

    await fandom.rebuild();

    const board = await CollectorBoard.findOne({ key: "collection" }).lean();
    expect(board.characterCount).toBe(3);
    expect(board.ranks.map((r) => String(r.userId))).toEqual([String(broad._id), String(deep._id)]);
    expect((await User.findById(deep._id).lean()).collectionRank).toMatchObject({
      distinct: 1,
      total: 50,
      rank: 2,
    });
  });
});

describe("fandom routes", () => {
  it("browses, searches and filters the open boards", async () => {
    const yuuma = await makeItem("Yuuma");
    await makeItem("Sannyo");
    await makeUser({ pinned: yuuma, inventory: copies(yuuma, 2) });
    await fandom.rebuild();

    const all = await request(app).get("/fandom");
    expect(all.status).toBe(200);
    expect(all.body.boards[0].name).toBe("Yuuma");
    expect(all.body.total).toBe(2);

    const open = await request(app).get("/fandom?sort=open");
    expect(open.body.boards.map((b) => b.name)).toEqual(["Sannyo"]);

    const found = await request(app).get("/fandom?q=yuu");
    expect(found.body.boards.map((b) => b.name)).toEqual(["Yuuma"]);
  });

  it("serves one board with its chasers", async () => {
    const yuuma = await makeItem("Yuuma");
    const fan = await makeUser({ pinned: yuuma, inventory: copies(yuuma, 7) });
    await fandom.rebuild();

    const res = await request(app).get("/fandom/Yuuma");
    expect(res.status).toBe(200);
    expect(res.body.topCount).toBe(7);
    expect(res.body.ranks).toHaveLength(1);
    expect(res.body.ranks[0].username).toBe(fan.username);

    expect((await request(app).get("/fandom/Nobody")).status).toBe(404);
  });

  it("tells a player which boards are within reach", async () => {
    const yuuma = await makeItem("Yuuma");
    const momiji = await makeItem("Momiji");
    const leader = await makeUser({ pinned: yuuma, inventory: copies(yuuma, 10) });
    const me = await makeUser({
      pinned: momiji,
      inventory: [...copies(yuuma, 9), ...copies(momiji, 1)],
    });
    await fandom.rebuild();

    const res = await request(app)
      .get("/fandom/reach")
      .set("Authorization", `Bearer ${tokenFor(me)}`);
    expect(res.status).toBe(200);
    const yuumaRow = res.body.reach.find((r) => r.name === "Yuuma");
    expect(yuumaRow).toMatchObject({ mine: 9, leader: 10, behind: 2, leaderName: leader.username });
    const momijiRow = res.body.reach.find((r) => r.name === "Momiji");
    expect(momijiRow).toMatchObject({ pinned: true, holding: true, behind: 0 });
  });

  it("reports the viewer's own standing on one board", async () => {
    const yuuma = await makeItem("Yuuma");
    await makeUser({ pinned: yuuma, inventory: copies(yuuma, 10) });
    const me = await makeUser({ inventory: copies(yuuma, 4) });
    await fandom.rebuild();

    const res = await request(app)
      .get("/fandom/Yuuma/me")
      .set("Authorization", `Bearer ${tokenFor(me)}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mine: 4, holding: false, pinned: false, behind: 7 });
    expect(String(res.body.itemId)).toBe(String(yuuma._id));
  });

  it("recounts both boards the moment a pin moves", async () => {
    const yuuma = await makeItem("Yuuma");
    const momiji = await makeItem("Momiji");
    const me = await makeUser({
      pinned: yuuma,
      inventory: [...copies(yuuma, 3), ...copies(momiji, 6)],
    });
    await fandom.rebuild();

    await fandom.refreshCharacters(["Yuuma", "Momiji"]);
    await User.updateOne({ _id: me._id }, { $set: { fixedItem: { name: "Momiji" } } });
    await fandom.refreshCharacters(["Yuuma", "Momiji"]);

    expect((await FanBoard.findOne({ name: "Yuuma" }).lean()).fanCount).toBe(0);
    const board = await FanBoard.findOne({ name: "Momiji" }).lean();
    expect(board.topCount).toBe(6);
    expect((await User.findById(me._id).lean()).fanRank.name).toBe("Momiji");
  });
});
