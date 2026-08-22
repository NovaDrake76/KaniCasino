process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const cardStyles = require("../../utils/cardStyles");

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

const crown = { name: "Yuuma", image: "y.png", rarity: "5", count: 12, rank: 1, fans: 4 };

describe("which styles a player holds", () => {
  it("gives the poster styles to a board leader and nothing else to a chaser", async () => {
    const leader = await makeUser({ fanRank: crown });
    const chaser = await makeUser({ fanRank: { ...crown, rank: 2, count: 3 } });

    expect(cardStyles.heldStyles(leader)).toEqual(cardStyles.KEYS);
    expect(cardStyles.heldStyles(chaser)).toEqual(["pinned"]);
    expect(cardStyles.heldStyles(await makeUser())).toEqual(["pinned"]);
  });

  it("falls back to the pinned panel once the board is lost", async () => {
    const fallen = await makeUser({ fanRank: { ...crown, rank: 2 }, cardStyle: "agit" });
    expect(cardStyles.wornStyle(fallen)).toBe("pinned");

    const leader = await makeUser({ fanRank: crown, cardStyle: "agit" });
    expect(cardStyles.wornStyle(leader)).toBe("agit");
  });

  it("reads an unknown stored style as the default", async () => {
    const user = await makeUser({ fanRank: crown, cardStyle: "not-a-style" });
    expect(cardStyles.wornStyle(user)).toBe("pinned");
  });
});

describe("PUT /users/card-style", () => {
  it("stores a poster style for a board leader", async () => {
    const user = await makeUser({ fanRank: crown });
    const res = await request(app)
      .put("/users/card-style")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ style: "notice" });

    expect(res.status).toBe(200);
    expect(res.body.cardStyle).toBe("notice");
    expect((await User.findById(user._id).select("cardStyle").lean()).cardStyle).toBe("notice");
  });

  it("refuses a poster style from a player who leads nothing", async () => {
    const user = await makeUser();
    const res = await request(app)
      .put("/users/card-style")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ style: "vhs" });

    expect(res.status).toBe(400);
    expect((await User.findById(user._id).select("cardStyle").lean()).cardStyle).toBeUndefined();
  });

  it("lets anyone keep the pinned panel", async () => {
    const user = await makeUser();
    const res = await request(app)
      .put("/users/card-style")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ style: "pinned" });

    expect(res.status).toBe(200);
    expect(res.body.cardStyle).toBe("pinned");
  });

  it("refuses a style that does not exist", async () => {
    const user = await makeUser({ fanRank: crown });
    const res = await request(app)
      .put("/users/card-style")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ style: "__proto__" });

    expect(res.status).toBe(400);
  });
});

describe("GET /users/me", () => {
  it("serves the worn style and what is open to the player", async () => {
    const user = await makeUser({ fanRank: crown, cardStyle: "funk" });
    const res = await request(app).get("/users/me").set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.status).toBe(200);
    expect(res.body.cardStyle).toBe("funk");
    expect(res.body.cardStyles).toEqual(cardStyles.KEYS);
  });

  it("hands a fallen leader the default without touching what is stored", async () => {
    const user = await makeUser({ fanRank: { ...crown, rank: 4 }, cardStyle: "funk" });
    const res = await request(app).get("/users/me").set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(res.body.cardStyle).toBe("pinned");
    expect(res.body.cardStyles).toEqual(["pinned"]);
    expect((await User.findById(user._id).select("cardStyle").lean()).cardStyle).toBe("funk");
  });
});
