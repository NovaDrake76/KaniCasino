process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const FanBoard = require("../../models/FanBoard");
const CollectorBoard = require("../../models/CollectorBoard");
const fandom = require("../../utils/fandom");
const Case = require("../../models/Case");
const { recomputeCaseValues } = require("../../utils/itemValue");

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

// what a copy actually looks like on the user document: name, image and case live on the
// catalog and are joined on read, so the entry only identifies the copy
function copies(item, count) {
  return Array.from({ length: count }, () => ({ _id: item._id, rarity: item.rarity }));
}

// rows written before that change still carry their own name, and must still count
function legacyCopies(item, count) {
  return Array.from({ length: count }, () => ({
    _id: item._id,
    name: item.name,
    image: item.image,
    rarity: item.rarity,
  }));
}

async function makeUser({ pinned, inventory = [], fixedAt, walletBalance = 0 } = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    walletBalance,
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

  it("measures the chase by the leader's margin, not by how popular the character is", async () => {
    const runaway = await makeItem("Yuuma");
    const closeRace = await makeItem("Momiji");
    const lonely = await makeItem("Sannyo");

    // three fans but a 60-copy lead: popular, not contested
    await makeUser({ pinned: runaway, inventory: copies(runaway, 63) });
    await makeUser({ pinned: runaway, inventory: copies(runaway, 3) });
    await makeUser({ pinned: runaway, inventory: copies(runaway, 1) });
    // two fans, one copy between them
    await makeUser({ pinned: closeRace, inventory: copies(closeRace, 5) });
    await makeUser({ pinned: closeRace, inventory: copies(closeRace, 4) });
    // one fan, nobody chasing
    await makeUser({ pinned: lonely, inventory: copies(lonely, 2) });

    await fandom.rebuild();

    const board = async (name) => FanBoard.findOne({ name }).lean();
    expect((await board("Yuuma")).gap).toBe(60);
    expect((await board("Momiji")).gap).toBe(1);
    expect((await board("Sannyo")).gap).toBe(999999);
    expect((await board("Momiji")).secondCount).toBe(4);

    // and the contested tab leads with the close race, not the popular one
    const res = await request(app).get("/fandom");
    expect(res.body.boards[0].name).toBe("Momiji");
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

  it("counts a copy whether or not it carries its own name", async () => {
    const yuuma = await makeItem("Yuuma");
    const momiji = await makeItem("Momiji");
    const me = await makeUser({
      pinned: yuuma,
      inventory: [...copies(yuuma, 4), ...legacyCopies(yuuma, 2), ...legacyCopies(momiji, 1)],
    });

    await fandom.rebuild();

    expect((await FanBoard.findOne({ name: "Yuuma" }).lean()).topCount).toBe(6);
    const mine = await User.findById(me._id).lean();
    expect(mine.fanRank.count).toBe(6);
    expect(mine.collectionRank).toMatchObject({ distinct: 2, total: 7 });
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

describe("a drop of the pinned character", () => {
  it("recounts the board before the next sweep", async () => {
    const yuuma = await makeItem("Yuuma", "1");
    const box = await Case.create({ title: `c-${uniqueSuffix()}`, image: "x", price: 10, items: [yuuma._id] });
    await recomputeCaseValues(box._id);
    const me = await makeUser({ pinned: yuuma, walletBalance: 1000 });
    await fandom.rebuild();
    expect((await User.findById(me._id).lean()).fanRank.count).toBe(0);

    const res = await request(app)
      .post(`/games/openCase/${box._id}`)
      .set("Authorization", `Bearer ${tokenFor(me)}`)
      .send({ quantity: 5 });
    expect(res.status).toBe(200);

    expect((await User.findById(me._id).lean()).fanRank.count).toBe(5);
    expect((await FanBoard.findOne({ name: "Yuuma" }).lean()).topCount).toBe(5);
  });
});

// an alt outfit is a separate catalog row carrying the base character's name, so both
// versions count as the same person on one board
describe("alt outfits", () => {
  const makeAlt = (name, character, rarity = "5") =>
    Item.create({ name, character, image: `${name}.png`, rarity, baseValue: 100 });

  it("counts a base copy and an alt copy as the same character", async () => {
    const base = await makeItem("Hoshino", "5");
    const alt = await makeAlt("Hoshino (Swimsuit)", "Hoshino");
    await makeUser({ pinned: base, inventory: [...copies(base, 1), ...copies(alt, 1)] });

    await fandom.rebuild();

    const board = await FanBoard.findOne({ name: "Hoshino" }).lean();
    expect(board.topCount).toBe(2);
    expect(await FanBoard.findOne({ name: "Hoshino (Swimsuit)" }).lean()).toBeNull();
  });

  it("gives an alt no board of its own", async () => {
    await makeItem("Hoshino", "5");
    await makeAlt("Hoshino (Swimsuit)", "Hoshino");

    const byName = await fandom.charactersByName();

    expect(byName.has("Hoshino")).toBe(true);
    expect(byName.has("Hoshino (Swimsuit)")).toBe(false);
    expect(byName.get("Hoshino").ids.size).toBe(2);
  });

  it("keeps the base look on the board when the alt is a different picture", async () => {
    const alt = await makeAlt("Hoshino (Swimsuit)", "Hoshino");
    const base = await makeItem("Hoshino", "5");

    const character = (await fandom.charactersByName(["Hoshino"])).get("Hoshino");

    expect(character.image).toBe(base.image);
    expect(character.ids.has(String(alt._id))).toBe(true);
  });

  it("puts someone who pinned the alt on the character's board", async () => {
    const base = await makeItem("Hoshino", "5");
    const alt = await makeAlt("Hoshino (Swimsuit)", "Hoshino");
    const owner = await makeUser({ inventory: copies(alt, 3) });
    const token = tokenFor(owner);

    await request(app)
      .put("/users/fixedItem")
      .set("Authorization", `Bearer ${token}`)
      .send({ item: String(alt._id) })
      .expect(200);

    const after = await User.findById(owner._id).select("fixedItem").lean();
    expect(after.fixedItem.name).toBe("Hoshino");
    expect(after.fixedItem.variant).toBe("Hoshino (Swimsuit)");
    expect(after.fixedItem.image).toBe(alt.image);

    await fandom.rebuild();
    const board = await FanBoard.findOne({ name: "Hoshino" }).lean();
    expect(board.topCount).toBe(3);
    expect(String(board.top.userId)).toBe(String(owner._id));
    expect(base).toBeTruthy();
  });

  it("does not reset the tie-break clock when swapping between two outfits", async () => {
    const base = await makeItem("Hoshino", "5");
    const alt = await makeAlt("Hoshino (Swimsuit)", "Hoshino");
    const owner = await makeUser({ pinned: base, inventory: copies(alt, 1) });
    await User.updateOne({ _id: owner._id }, { $set: { fixedAt: new Date("2020-01-01") } });
    const token = tokenFor(owner);

    await request(app)
      .put("/users/fixedItem")
      .set("Authorization", `Bearer ${token}`)
      .send({ item: String(alt._id) })
      .expect(200);

    const after = await User.findById(owner._id).select("fixedAt").lean();
    expect(after.fixedAt.toISOString()).toBe(new Date("2020-01-01").toISOString());
  });

  it("clears the outfit when the pin moves back to the base look", async () => {
    const base = await makeItem("Hoshino", "5");
    const alt = await makeAlt("Hoshino (Swimsuit)", "Hoshino");
    const owner = await makeUser({ inventory: [...copies(alt, 1), ...copies(base, 1)] });
    const token = tokenFor(owner);
    const pin = (id) =>
      request(app)
        .put("/users/fixedItem")
        .set("Authorization", `Bearer ${token}`)
        .send({ item: String(id) })
        .expect(200);

    await pin(alt._id);
    expect((await User.findById(owner._id).lean()).fixedItem.variant).toBe("Hoshino (Swimsuit)");

    await pin(base._id);
    const after = await User.findById(owner._id).lean();
    expect(after.fixedItem.variant).toBeUndefined();
    expect(after.fixedItem.image).toBe(base.image);
  });

  it("leaves an ordinary item counting under its own name", async () => {
    const plain = await makeItem("Cirno", "4");
    await makeUser({ pinned: plain, inventory: copies(plain, 2) });

    await fandom.rebuild();

    const board = await FanBoard.findOne({ name: "Cirno" }).lean();
    expect(board.topCount).toBe(2);
  });
});

// two series can use one first name: Touhou and Blue Archive both have a Yukari, a Junko
// and a Yuuka. sharing a board counted their copies together and hung the wrong portrait
// on somebody's badge, so the newer side carries a name of its own.
describe("a name two collections share", () => {
  const makeAlt = (name, character, rarity = "5") =>
    Item.create({ name, character, image: `${name}.png`, rarity, baseValue: 100 });

  it("keeps the two on separate boards", async () => {
    const touhou = await makeItem("Yukari", "4");
    const archive = await makeAlt("Yukari", "Yukari (Blue Archive)", "2");
    await makeUser({ pinned: touhou, inventory: [...copies(touhou, 3), ...copies(archive, 5)] });

    await fandom.rebuild();

    // the five from the other series must not count toward the board they did not join
    const mine = await FanBoard.findOne({ name: "Yukari" }).lean();
    expect(mine.topCount).toBe(3);
    const theirs = await FanBoard.findOne({ name: "Yukari (Blue Archive)" }).lean();
    expect(theirs.fanCount).toBe(0);
  });

  it("hangs each board's own portrait", async () => {
    const touhou = await makeItem("Yukari", "4");
    const archive = await makeAlt("Yukari", "Yukari (Blue Archive)", "2");

    const byName = await fandom.charactersByName();

    expect(byName.get("Yukari").image).toBe(touhou.image);
    expect(byName.get("Yukari (Blue Archive)").image).toBe(archive.image);
  });

  // every item in the moved group carries a character now, so the base look can no longer
  // be told by that field alone
  it("still prefers the base look over an alt on the moved side", async () => {
    const alt = await makeAlt("Yukari (Swimsuit)", "Yukari (Blue Archive)", "1");
    const base = await makeAlt("Yukari", "Yukari (Blue Archive)", "2");

    const character = (await fandom.charactersByName(["Yukari (Blue Archive)"])).get("Yukari (Blue Archive)");

    expect(character.image).toBe(base.image);
    expect(character.rarity).toBe("2");
    expect(character.ids.has(String(alt._id))).toBe(true);
  });

  it("counts a base and its alt together on the moved side", async () => {
    const base = await makeAlt("Yukari", "Yukari (Blue Archive)", "2");
    const alt = await makeAlt("Yukari (Swimsuit)", "Yukari (Blue Archive)", "1");
    await makeUser({
      pinned: { name: "Yukari (Blue Archive)", image: base.image, rarity: base.rarity },
      inventory: [...copies(base, 2), ...copies(alt, 4)],
    });

    await fandom.rebuild();

    const board = await FanBoard.findOne({ name: "Yukari (Blue Archive)" }).lean();
    expect(board.topCount).toBe(6);
  });

  it("pins the moved base without calling it an outfit", async () => {
    const base = await makeAlt("Yukari", "Yukari (Blue Archive)", "2");
    const owner = await makeUser({ inventory: copies(base, 1) });

    await request(app)
      .put("/users/fixedItem")
      .set("Authorization", `Bearer ${tokenFor(owner)}`)
      .send({ item: String(base._id) })
      .expect(200);

    const after = await User.findById(owner._id).select("fixedItem").lean();
    expect(after.fixedItem.name).toBe("Yukari (Blue Archive)");
    expect(after.fixedItem.variant).toBeUndefined();
  });
});
