process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(overrides = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    walletBalance: 0,
    ...overrides,
  });
}

async function makeItem(name, image, rarity = "3") {
  return Item.create({ name, image, rarity });
}

function entry(item) {
  return { _id: item._id, name: item.name, image: item.image, rarity: item.rarity, case: item.case };
}

describe("avatar options", () => {
  it("offers every distinct item held, stacked rather than repeated", async () => {
    const yuuma = await makeItem("Yuuma", "yuuma.png", "5");
    const reimu = await makeItem("Reimu", "reimu.png", "2");
    const user = await makeUser({
      profilePicture: "base.png",
      basePicture: "base.png",
      inventory: [entry(yuuma), entry(yuuma), entry(yuuma), entry(reimu)],
    });

    const res = await request(app)
      .get("/users/avatars")
      .set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    // rarest first, so the item worth showing off is not buried
    expect(res.body.items[0]).toMatchObject({ name: "Yuuma", image: "yuuma.png", count: 3 });
    expect(res.body.items[1]).toMatchObject({ name: "Reimu", count: 1 });
    expect(res.body.base).toBe("base.png");
  });

  it("reads the image off the catalog, not off the stored inventory copy", async () => {
    const item = await makeItem("Yuuma", "redrawn.png");
    const user = await makeUser({
      inventory: [{ ...entry(item), image: "stale.png" }],
    });

    const res = await request(app)
      .get("/users/avatars")
      .set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.body.items[0].image).toBe("redrawn.png");
  });

  it("is private", async () => {
    const res = await request(app).get("/users/avatars");
    expect(res.status).toBe(401);
  });
});

describe("picking an avatar", () => {
  it("wears an item the player holds", async () => {
    const item = await makeItem("Yuuma", "yuuma.png");
    const user = await makeUser({ profilePicture: "base.png", inventory: [entry(item)] });

    const res = await request(app)
      .put("/users/avatar")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ itemId: item._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.profilePicture).toBe("yuuma.png");
    const after = await User.findById(user._id);
    expect(after.profilePicture).toBe("yuuma.png");
  });

  it("refuses an item the player does not hold", async () => {
    const item = await makeItem("Yuuma", "yuuma.png");
    const user = await makeUser({ profilePicture: "base.png" });

    const res = await request(app)
      .put("/users/avatar")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ itemId: item._id.toString() });

    expect(res.status).toBe(400);
    const after = await User.findById(user._id);
    expect(after.profilePicture).toBe("base.png");
  });

  it("takes an id and never a url, so nothing arbitrary can reach a profile", async () => {
    const user = await makeUser({ profilePicture: "base.png" });

    const res = await request(app)
      .put("/users/avatar")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ itemId: "https://evil.example/anything.png" });

    expect(res.status).toBe(400);
    const after = await User.findById(user._id);
    expect(after.profilePicture).toBe("base.png");
  });

  it("remembers the picture the account came with, so the change can be undone", async () => {
    const item = await makeItem("Yuuma", "yuuma.png");
    const user = await makeUser({ profilePicture: "google.png", inventory: [entry(item)] });
    const auth = `Bearer ${tokenFor(user)}`;

    await request(app).put("/users/avatar").set("Authorization", auth).send({ itemId: item._id.toString() });
    const res = await request(app).put("/users/avatar").set("Authorization", auth).send({ itemId: null });

    expect(res.body.profilePicture).toBe("google.png");
  });
});

describe("the upload path", () => {
  it("is gone", async () => {
    const user = await makeUser({ profilePicture: "base.png" });

    const res = await request(app)
      .put("/users/profilePicture")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ image: "data:image/png;base64,iVBORw0KGgo=" });

    expect(res.status).toBe(404);
    const after = await User.findById(user._id);
    expect(after.profilePicture).toBe("base.png");
  });

  it("cannot be reopened through register", async () => {
    const s = uniqueSuffix();
    const res = await request(app).post("/users/register").send({
      email: `new-${s}@example.com`,
      username: `new-${s}`,
      password: "secret1",
      profilePicture: "data:image/png;base64,iVBORw0KGgo=",
    });

    expect(res.status).toBe(200);
    const created = await User.findOne({ username: `new-${s}` });
    expect(created.profilePicture).not.toMatch(/^data:/);
    expect(created.basePicture).toBe(created.profilePicture);
  });
});
