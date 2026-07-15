process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const Transaction = require("../../models/Transaction");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const auth = (user) => ["Authorization", `Bearer ${tokenFor(user)}`];

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

async function makeCase(specs) {
  const items = [];
  for (const spec of specs) {
    items.push(
      await Item.create({
        name: `item-${uniqueSuffix()}`,
        image: "i.png",
        rarity: String(spec.rarity),
        baseValue: spec.baseValue,
      })
    );
  }
  const c = await Case.create({
    title: `case-${uniqueSuffix()}`,
    image: "c.png",
    price: 100,
    items: items.map((i) => i._id),
  });
  await Item.updateMany({ _id: { $in: items.map((i) => i._id) } }, { case: c._id });
  return { c, items };
}

// push n copies of `item` tagged to `caseId`, oldest first; returns their uniqueIds
async function give(user, item, n, caseId) {
  const ids = [];
  const base = 1_700_000_000_000;
  for (let k = 0; k < n; k++) {
    const uniqueId = `uid-${uniqueSuffix()}`;
    ids.push(uniqueId);
    await User.updateOne(
      { _id: user._id },
      {
        $push: {
          inventory: {
            _id: item._id,
            name: item.name,
            image: item.image,
            rarity: item.rarity,
            case: caseId,
            uniqueId,
            createdAt: new Date(base + k * 1000),
          },
        },
      }
    );
  }
  return ids;
}

const preview = (user, caseId) =>
  request(app).post("/collections/quicksell/preview").set(...auth(user)).send({ caseId: String(caseId) });
const commit = (user, caseId, plan) =>
  request(app).post("/collections/quicksell/commit").set(...auth(user)).send({ caseId: String(caseId), plan });

async function invOf(user) {
  return (await User.findById(user._id)).inventory;
}

describe("quicksell preview", () => {
  test("plans to sell all but one of each duplicated, priced item", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([
      { rarity: 1, baseValue: 100 }, // sellValue 75
      { rarity: 3, baseValue: 400 }, // sellValue 300
    ]);
    await give(u, items[0], 5, c._id); // sell 4 -> 300
    await give(u, items[1], 2, c._id); // sell 1 -> 300

    const res = await preview(u, c._id);
    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(5);
    expect(res.body.totalValue).toBe(600);
    const line0 = res.body.lines.find((l) => l._id === items[0]._id.toString());
    expect(line0.sellCount).toBe(4);
    expect(line0.lineValue).toBe(300);
    expect(res.body.plan).toHaveLength(5);
  });

  test("no duplicates -> empty plan", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 100 }]);
    await give(u, items[0], 1, c._id);
    const res = await preview(u, c._id);
    expect(res.body.totalItems).toBe(0);
    expect(res.body.plan).toEqual([]);
  });

  test("zero-value duplicates are never planned", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 0 }]);
    await give(u, items[0], 4, c._id);
    const res = await preview(u, c._id);
    expect(res.body.totalItems).toBe(0);
    expect(res.body.totalValue).toBe(0);
  });
});

describe("quicksell commit", () => {
  test("keeps exactly one, credits the rest, writes one ledger row", async () => {
    const u = await makeUser({ walletBalance: 10 });
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 100 }]);
    const uids = await give(u, items[0], 5, c._id); // keep oldest (uids[0]), sell 4 -> 300

    const p = await preview(u, c._id);
    const res = await commit(u, c._id, p.body.plan);
    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(false);
    expect(res.body.sold).toBe(4);
    expect(res.body.value).toBe(300);
    expect(res.body.walletBalance).toBe(310);

    const inv = await invOf(u);
    expect(inv).toHaveLength(1);
    expect(inv[0].uniqueId).toBe(uids[0]); // the oldest survived

    const rows = await Transaction.find({ userId: u._id, type: "item_sell" });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(300);
    expect(rows[0].meta.source).toBe("quicksell");
  });

  test("a gained copy since preview blocks the sale and returns a fresh preview", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 100 }]);
    await give(u, items[0], 5, c._id);
    const p = await preview(u, c._id); // plan sells 4

    await give(u, items[0], 1, c._id); // now owns 6; a new duplicate appeared

    const res = await commit(u, c._id, p.body.plan);
    expect(res.body.changed).toBe(true);
    expect(res.body.totalItems).toBe(5); // fresh preview: now sells 5
    expect((await invOf(u))).toHaveLength(6); // nothing sold
  });

  test("a copy sold elsewhere since preview blocks the sale", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 100 }]);
    const uids = await give(u, items[0], 5, c._id);
    const p = await preview(u, c._id);

    // sell one of the planned copies through the normal sell endpoint
    await request(app).post("/users/inventory/sell").set(...auth(u)).send({ uniqueId: uids[4] });

    const res = await commit(u, c._id, p.body.plan);
    expect(res.body.changed).toBe(true);
    expect(res.body.totalItems).toBe(3); // 4 owned now -> sell 3
  });

  test("cannot be tricked into selling the kept copy", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 100 }]);
    const uids = await give(u, items[0], 3, c._id);
    const p = await preview(u, c._id);
    const tampered = [...p.body.plan, uids[0]]; // append the keep copy

    const res = await commit(u, c._id, tampered);
    expect(res.body.changed).toBe(true); // mismatch -> refused
    expect((await invOf(u))).toHaveLength(3); // nothing sold, keep intact
  });

  test("a foreign uniqueId in the plan is refused, nothing sold", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 100 }]);
    await give(u, items[0], 3, c._id);
    const res = await commit(u, c._id, ["uid-does-not-exist", "uid-nope"]);
    expect(res.body.changed).toBe(true);
    expect((await invOf(u))).toHaveLength(3);
  });

  test("extras (removed from the case) are never quicksold", async () => {
    const u = await makeUser();
    const { c, items } = await makeCase([
      { rarity: 1, baseValue: 100 },
      { rarity: 2, baseValue: 200 },
    ]);
    await give(u, items[0], 2, c._id); // in-case duplicate -> sold
    await give(u, items[1], 4, c._id); // will be removed from the case
    await Case.updateOne({ _id: c._id }, { $pull: { items: items[1]._id } });

    const p = await preview(u, c._id);
    // only items[0]'s single duplicate is planned; the 4 extras are untouched
    expect(p.body.totalItems).toBe(1);
    const res = await commit(u, c._id, p.body.plan);
    expect(res.body.sold).toBe(1);
    const inv = await invOf(u);
    expect(inv.filter((i) => String(i._id) === items[1]._id.toString())).toHaveLength(4);
  });

  test("concurrent identical commits credit exactly once and leave one copy", async () => {
    const u = await makeUser({ walletBalance: 0 });
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 100 }]);
    await give(u, items[0], 5, c._id);
    const p = await preview(u, c._id);

    const [r1, r2] = await Promise.all([
      commit(u, c._id, p.body.plan),
      commit(u, c._id, p.body.plan),
    ]);

    const soldTotal = (r1.body.sold || 0) + (r2.body.sold || 0);
    expect(soldTotal).toBe(4); // exactly the 4 duplicates, never 8
    expect((await User.findById(u._id)).walletBalance).toBe(300);
    expect((await invOf(u))).toHaveLength(1);
    const rows = await Transaction.find({ userId: u._id, type: "item_sell" });
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(300);
  });

  test("commit racing an external sell never over-credits", async () => {
    const u = await makeUser({ walletBalance: 0 });
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 100 }]);
    const uids = await give(u, items[0], 5, c._id);
    const p = await preview(u, c._id);

    const [qs] = await Promise.all([
      commit(u, c._id, p.body.plan),
      request(app).post("/users/inventory/sell").set(...auth(u)).send({ uniqueId: uids[4] }),
    ]);

    // whatever interleaving, the wallet only ever reflects copies actually removed,
    // priced at 75 each, and at least the kept copy survives
    const wallet = (await User.findById(u._id)).walletBalance;
    expect(wallet % 75).toBe(0);
    expect(wallet).toBeLessThanOrEqual(4 * 75);
    expect((await invOf(u)).length).toBeGreaterThanOrEqual(1);
    expect([200]).toContain(qs.status);
  });

  test("requires auth and ignores a body userId", async () => {
    const u = await makeUser();
    const other = await makeUser({ walletBalance: 999 });
    const { c, items } = await makeCase([{ rarity: 1, baseValue: 100 }]);
    await give(u, items[0], 3, c._id);

    const noAuth = await request(app).post("/collections/quicksell/commit").send({ caseId: String(c._id), plan: [] });
    expect(noAuth.status).toBe(401);

    // a userId in the body must not target another account
    const p = await preview(u, c._id);
    await request(app)
      .post("/collections/quicksell/commit")
      .set(...auth(u))
      .send({ caseId: String(c._id), plan: p.body.plan, userId: other._id.toString() });
    expect((await User.findById(other._id)).walletBalance).toBe(999); // untouched
  });
});
