process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Case = require("../../models/Case");
const Item = require("../../models/Item");
const gift = require("../../utils/dailyGift");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const makeUser = (over = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@example.com`, password: "x", ...over });
};

async function makeCase(price, category) {
  const s = uniqueSuffix();
  const item = await Item.create({ name: `item-${s}`, image: "i.png", rarity: 1 });
  return Case.create({ title: `case-${s}`, image: "c.png", price, category, items: [item._id] });
}

const seedCategory = async (category, prices) => {
  for (const p of prices) await makeCase(p, category);
};

describe("the category picker", () => {
  it("offers every category with a table, and publishes the odds", async () => {
    await seedCategory("Touhou", [60, 60]);
    await seedCategory("Uma Musume", [30, 50]);
    const u = await makeUser();

    const res = await auth(request(app).get("/gift"), u);

    expect(res.status).toBe(200);
    expect(res.body.categories.map((c) => c.category).sort()).toEqual(["Touhou", "Uma Musume"]);
    for (const c of res.body.categories) {
      expect(c.slots).toHaveLength(gift.SLOTS.length);
      const chance = c.slots.reduce((a, s) => a + s.chance, 0);
      expect(chance).toBeGreaterThan(99.8);
      expect(chance).toBeLessThan(100.2);
    }
  });

  it("hides a category whose every case is above the cap", async () => {
    await seedCategory("Touhou", [60]);
    await seedCategory("Grails", [1324450]);
    const u = await makeUser();

    const res = await auth(request(app).get("/gift"), u);
    expect(res.body.categories.map((c) => c.category)).toEqual(["Touhou"]);
  });

  it("keeps every category worth about the same, so picking your own costs nothing", async () => {
    await seedCategory("Uma Musume", [30, 30, 40, 45, 50]);
    await seedCategory("Counter-Strike", [15, 130, 352, 690, 1859]);
    const u = await makeUser();

    const res = await auth(request(app).get("/gift"), u);
    const evs = res.body.categories.map((c) => c.expectedValue);
    expect(Math.max(...evs) / Math.min(...evs)).toBeLessThan(1.35);
  });
});

describe("what the streak is worth", () => {
  it("says how many days it takes to reach the best odds", async () => {
    await seedCategory("Touhou", [60]);
    const u = await makeUser();

    const res = await auth(request(app).get("/gift"), u);

    expect(res.body.streakMax).toBe(gift.STREAK_DAYS);
    expect(res.body.streakMax).toBe(7);
  });

  // a streak on the document always has a spin behind it. a fixture that sets giftStreak
  // with no giftLastAt is an account production never writes, and it reads as lapsed.
  const onStreak = (days, over = {}) =>
    makeUser({
      giftStreak: days,
      giftLastAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      giftNextAt: new Date(Date.now() - 60 * 1000),
      ...over,
    });

  it("quotes a boost that climbs with the streak and tops out at the last day", async () => {
    await seedCategory("Touhou", [60]);
    const fresh = await makeUser({ level: 60 });
    const halfway = await onStreak(4, { level: 60 });

    const a = await auth(request(app).get("/gift"), fresh);
    const b = await auth(request(app).get("/gift"), halfway);

    expect(b.body.rareBoost).toBeGreaterThan(a.body.rareBoost);
    expect(a.body.atBestStreak.rareBoost).toBeGreaterThan(b.body.rareBoost);
    // the advertised best is the same number whatever the streak is today
    expect(b.body.atBestStreak.rareBoost).toBe(a.body.atBestStreak.rareBoost);
  });

  it("stops promising more once the streak is already there", async () => {
    await seedCategory("Touhou", [60]);
    const maxed = await onStreak(gift.STREAK_DAYS, { level: 60 });

    const res = await auth(request(app).get("/gift"), maxed);

    expect(res.body.rareBoost).toBe(res.body.atBestStreak.rareBoost);
  });

  it("quotes the weight the spin actually puts on the rarest prize", async () => {
    // the number on the card is priced off the streak the next spin will roll on, not the
    // one banked, so a player on day 4 with a spin waiting is quoted day 5
    await seedCategory("Touhou", [60]);
    const u = await onStreak(4, { level: 60 });

    const res = await auth(request(app).get("/gift"), u);
    const table = gift.tableFor(await Case.find({ category: "Touhou" }).lean());
    const plain = gift.weightsFor(table, 0);
    const streaked = gift.weightsFor(table, 5);
    const rarest = table.length - 1;

    expect(res.body.streak).toBe(4);
    expect(res.body.rareBoost).toBeCloseTo(streaked[rarest] / plain[rarest], 2);
  });
});

describe("the top slot on the state", () => {
  it("shows the whole wheel, marking what the level has not earned yet", async () => {
    await seedCategory("Touhou", [60]);
    const u = await makeUser({ level: 8 });

    const res = await auth(request(app).get("/gift"), u);

    expect(res.body.topSlot).toHaveLength(gift.TOP_SLOT.length);
    const locked = res.body.topSlot.filter((t) => t.locked).map((t) => t.multiplier);
    expect(locked).toEqual([3, 5, 10, 25]);
    for (const t of res.body.topSlot.filter((x) => x.locked)) expect(t.chance).toBe(0);
  });

  it("unlocks the higher rungs as the level climbs", async () => {
    await seedCategory("Touhou", [60]);
    const low = await makeUser({ level: 8 });
    const high = await makeUser({ level: 60 });

    const a = await auth(request(app).get("/gift"), low);
    const b = await auth(request(app).get("/gift"), high);

    expect(a.body.topSlot.filter((t) => !t.locked)).toHaveLength(2);
    expect(b.body.topSlot.filter((t) => !t.locked)).toHaveLength(5);
    expect(b.body.topSlotAverage).toBeGreaterThan(a.body.topSlotAverage);
  });
});

describe("spinning", () => {
  it("grants free openings of one specific case", async () => {
    await seedCategory("Touhou", [60, 60]);
    const u = await makeUser();

    const res = await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });

    expect(res.status).toBe(200);
    expect(res.body.opens).toBeGreaterThanOrEqual(1);
    const after = await User.findById(u._id);
    expect(after.freeOpens).toHaveLength(1);
    expect(after.freeOpens[0].remaining).toBe(res.body.opens);
    expect(String(after.freeOpens[0].caseId)).toBe(res.body.won.caseId);
  });

  it("tops up an existing grant instead of leaving two on the same case", async () => {
    // one case in the category, so both spins have to land on it
    await seedCategory("Touhou", [60]);
    const u = await makeUser();

    const first = await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });
    await User.updateOne({ _id: u._id }, { $unset: { giftNextAt: "" } });
    const second = await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });

    const after = await User.findById(u._id);
    expect(after.freeOpens).toHaveLength(1);
    expect(after.freeOpens[0].remaining).toBe(first.body.opens + second.body.opens);
    expect(second.body.grantRemaining).toBe(first.body.opens + second.body.opens);
    expect(second.body.grantId).toBe(first.body.grantId);

    // and the case page sees the one merged total, not the older half of it
    const grants = await auth(request(app).get("/gift/grants"), u);
    expect(grants.body).toHaveLength(1);
    expect(grants.body[0].remaining).toBe(first.body.opens + second.body.opens);
  });

  it("keeps grants for different cases apart", async () => {
    await seedCategory("Touhou", [60]);
    await seedCategory("Counter-Strike", [60]);
    const u = await makeUser();

    await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });
    await User.updateOne({ _id: u._id }, { $unset: { giftNextAt: "" } });
    await auth(request(app).post("/gift/spin"), u).send({ category: "Counter-Strike" });

    expect((await User.findById(u._id)).freeOpens).toHaveLength(2);
  });

  it("multiplies the reel by whatever the top slot lands on", async () => {
    await seedCategory("Touhou", [60]);
    const u = await makeUser({ level: 60 });

    const res = await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });

    expect(res.body.opens).toBe(res.body.won.opens * res.body.topSlot.multiplier);
    expect(res.body.topSlot.hit).toBe(res.body.topSlot.multiplier > 1);
  });

  it("never awards a multiplier the level has not unlocked", async () => {
    await seedCategory("Touhou", [60]);
    const allowed = gift.TOP_SLOT.filter((t) => t.minLevel <= 0).map((t) => t.multiplier);

    for (let i = 0; i < 12; i++) {
      const u = await makeUser({ level: 0 });
      const res = await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });
      expect(allowed).toContain(res.body.topSlot.multiplier);
    }
  });

  it("starts the streak and opens the next spin at the coming reset", async () => {
    await seedCategory("Touhou", [60]);
    const u = await makeUser();

    const res = await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });

    expect(res.body.streak).toBe(1);
    const after = await User.findById(u._id);
    // the boundary, not an offset from the spin, so tomorrow's window cannot creep later
    expect(new Date(after.giftNextAt).toISOString()).toBe(gift.nextResetAt(new Date()).toISOString());
    expect(new Date(after.giftNextAt).getUTCHours()).toBe(gift.RESET_HOUR_UTC);
  });

  it("refuses a second spin the same day", async () => {
    await seedCategory("Touhou", [60]);
    const u = await makeUser();
    await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });

    const second = await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });

    expect(second.status).toBe(400);
    expect((await User.findById(u._id)).freeOpens).toHaveLength(1);
  });

  it("refuses a category that does not exist", async () => {
    await seedCategory("Touhou", [60]);
    const u = await makeUser();

    const res = await auth(request(app).post("/gift/spin"), u).send({ category: "Nope" });
    expect(res.status).toBe(400);
  });

  it("expires the grant with the day", async () => {
    await seedCategory("Touhou", [60]);
    const u = await makeUser();
    await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });

    const g = (await User.findById(u._id)).freeOpens[0];
    const ttl = new Date(g.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(gift.GRANT_TTL_MS - 60000);
    expect(ttl).toBeLessThanOrEqual(gift.GRANT_TTL_MS);
  });

  it("never grants a case above the price cap", async () => {
    await seedCategory("Touhou", [60, 12000]);
    const u = await makeUser();

    const res = await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });
    const won = await Case.findById(res.body.won.caseId);
    expect(won.price).toBeLessThanOrEqual(gift.MAX_CASE_PRICE);
  });
});

describe("spending a grant", () => {
  const grantFor = async (user, caseDoc, remaining, expiresAt) =>
    User.findOneAndUpdate(
      { _id: user._id },
      {
        $push: {
          freeOpens: {
            caseId: caseDoc._id,
            remaining,
            expiresAt: expiresAt || new Date(Date.now() + 3600000),
          },
        },
      },
      { new: true }
    );

  it("opens without touching the wallet and spends one opening", async () => {
    const c = await makeCase(500, "Touhou");
    const u = await makeUser({ walletBalance: 0 });
    const withGrant = await grantFor(u, c, 3);

    const res = await auth(request(app).post(`/games/openCase/${c._id}`), u).send({
      quantity: 1,
      grantId: withGrant.freeOpens[0].grantId,
    });

    expect(res.status).toBe(200);
    const after = await User.findById(u._id);
    expect(after.walletBalance).toBe(0);
    expect(after.inventory).toHaveLength(1);
    expect(after.freeOpens[0].remaining).toBe(2);
  });

  it("spends several at once when the quantity asks for it", async () => {
    const c = await makeCase(500, "Touhou");
    const u = await makeUser({ walletBalance: 0 });
    const withGrant = await grantFor(u, c, 5);

    await auth(request(app).post(`/games/openCase/${c._id}`), u).send({
      quantity: 3,
      grantId: withGrant.freeOpens[0].grantId,
    });

    const after = await User.findById(u._id);
    expect(after.freeOpens[0].remaining).toBe(2);
    expect(after.inventory).toHaveLength(3);
  });

  // the whole reason a grant names a case rather than a category
  it("refuses to spend it on a different case", async () => {
    const granted = await makeCase(30, "Uma Musume");
    const other = await makeCase(1859, "Uma Musume");
    const u = await makeUser({ walletBalance: 0 });
    const withGrant = await grantFor(u, granted, 5);

    const res = await auth(request(app).post(`/games/openCase/${other._id}`), u).send({
      quantity: 1,
      grantId: withGrant.freeOpens[0].grantId,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/different case/i);
    expect((await User.findById(u._id)).freeOpens[0].remaining).toBe(5);
  });

  it("refuses more openings than are left", async () => {
    const c = await makeCase(500, "Touhou");
    const u = await makeUser({ walletBalance: 0 });
    const withGrant = await grantFor(u, c, 2);

    const res = await auth(request(app).post(`/games/openCase/${c._id}`), u).send({
      quantity: 3,
      grantId: withGrant.freeOpens[0].grantId,
    });

    expect(res.status).toBe(400);
    expect((await User.findById(u._id)).freeOpens[0].remaining).toBe(2);
  });

  it("refuses an expired grant", async () => {
    const c = await makeCase(500, "Touhou");
    const u = await makeUser({ walletBalance: 0 });
    const withGrant = await grantFor(u, c, 3, new Date(Date.now() - 1000));

    const res = await auth(request(app).post(`/games/openCase/${c._id}`), u).send({
      quantity: 1,
      grantId: withGrant.freeOpens[0].grantId,
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it("refuses a grant belonging to somebody else", async () => {
    const c = await makeCase(500, "Touhou");
    const owner = await makeUser();
    const thief = await makeUser({ walletBalance: 0 });
    const withGrant = await grantFor(owner, c, 3);

    const res = await auth(request(app).post(`/games/openCase/${c._id}`), thief).send({
      quantity: 1,
      grantId: withGrant.freeOpens[0].grantId,
    });

    expect(res.status).toBe(404);
    expect((await User.findById(owner._id)).freeOpens[0].remaining).toBe(3);
  });

  it("cannot be overdrawn by two opens racing each other", async () => {
    const c = await makeCase(500, "Touhou");
    const u = await makeUser({ walletBalance: 0 });
    const withGrant = await grantFor(u, c, 1);
    const grantId = withGrant.freeOpens[0].grantId;

    const [a, b] = await Promise.all([
      auth(request(app).post(`/games/openCase/${c._id}`), u).send({ quantity: 1, grantId }),
      auth(request(app).post(`/games/openCase/${c._id}`), u).send({ quantity: 1, grantId }),
    ]);

    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
    const after = await User.findById(u._id);
    expect(after.freeOpens[0].remaining).toBe(0);
    expect(after.inventory).toHaveLength(1);
    expect(after.walletBalance).toBe(0);
  });

  it("still charges normally when no grant is passed", async () => {
    const c = await makeCase(400, "Touhou");
    const u = await makeUser({ walletBalance: 1000 });

    const res = await auth(request(app).post(`/games/openCase/${c._id}`), u).send({ quantity: 1 });

    expect(res.status).toBe(200);
    expect((await User.findById(u._id)).walletBalance).toBe(600);
  });
});

describe("a streak that has already lapsed", () => {
  it("is not still advertised as full", async () => {
    await seedCategory("Touhou", [60]);
    const stale = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const u = await makeUser({ giftStreak: 7, giftLastAt: stale, giftNextAt: stale });

    const res = await auth(request(app).get("/gift"), u);

    expect(res.body.streak).toBe(0);
    expect(res.body.streakTilt).toBe(gift.streakTilt(1));
  });

  it("quotes the odds the spin will actually roll on", async () => {
    // the page used to price the table off the stored streak while the spin rolled on the
    // recomputed one, so a lapsed player was shown chances that did not exist
    await seedCategory("Touhou", [60]);
    const stale = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const lapsed = await makeUser({ giftStreak: 7, giftLastAt: stale, giftNextAt: stale });
    const fresh = await makeUser();

    const a = await auth(request(app).get("/gift"), lapsed);
    const b = await auth(request(app).get("/gift"), fresh);

    expect(a.body.categories[0].slots.map((s) => s.chance)).toEqual(
      b.body.categories[0].slots.map((s) => s.chance)
    );
  });

  it("says so on the light status the prompt reads too", async () => {
    const stale = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const u = await makeUser({ giftStreak: 7, giftLastAt: stale, giftNextAt: stale });

    const res = await auth(request(app).get("/gift/status"), u);

    expect(res.body.streak).toBe(0);
    expect(res.body.nextStreak).toBe(1);
    expect(res.body.keepsStreak).toBe(false);
  });
});

describe("status", () => {
  it("says a spin is waiting before the first one", async () => {
    const u = await makeUser();

    const res = await auth(request(app).get("/gift/status"), u);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      canSpin: true,
      nextAt: null,
      streak: 0,
      nextStreak: 1,
      keepsStreak: false,
    });
  });

  it("says what the waiting spin would carry the streak to", async () => {
    // the prompt has to name the stake, so the status has to know it before the spin
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const u = await makeUser({ giftStreak: 3, giftLastAt: yesterday, giftNextAt: yesterday });

    const res = await auth(request(app).get("/gift/status"), u);

    expect(res.body.canSpin).toBe(true);
    expect(res.body.streak).toBe(3);
    expect(res.body.nextStreak).toBe(4);
    expect(res.body.keepsStreak).toBe(true);
  });

  it("stops saying so once today's gift is taken", async () => {
    await seedCategory("Touhou", [60]);
    const u = await makeUser();

    await auth(request(app).post("/gift/spin"), u).send({ category: "Touhou" });
    const res = await auth(request(app).get("/gift/status"), u);

    expect(res.body.canSpin).toBe(false);
    expect(new Date(res.body.nextAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("listing grants", () => {
  const grantFor = async (user, caseDoc, remaining, expiresAt) =>
    User.findOneAndUpdate(
      { _id: user._id },
      {
        $push: {
          freeOpens: {
            caseId: caseDoc._id,
            remaining,
            expiresAt: expiresAt || new Date(Date.now() + 3600000),
          },
        },
      },
      { new: true }
    );

  it("returns what is still open to spend", async () => {
    const c = await makeCase(500, "Touhou");
    const u = await makeUser({});
    await grantFor(u, c, 4);

    const res = await auth(request(app).get("/gift/grants"), u);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      caseId: String(c._id),
      remaining: 4,
      title: c.title,
      image: c.image,
    });
  });

  it("filters to one case so the case page only sees its own", async () => {
    const mine = await makeCase(500, "Touhou");
    const other = await makeCase(500, "Touhou");
    const u = await makeUser({});
    await grantFor(u, mine, 2);
    await grantFor(u, other, 7);

    const res = await auth(request(app).get("/gift/grants").query({ caseId: String(mine._id) }), u);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].remaining).toBe(2);
  });

  it("leaves out the spent and the expired", async () => {
    const c = await makeCase(500, "Touhou");
    const u = await makeUser({});
    await grantFor(u, c, 0);
    await grantFor(u, c, 3, new Date(Date.now() - 1000));

    const res = await auth(request(app).get("/gift/grants"), u);

    expect(res.body).toHaveLength(0);
  });
});
