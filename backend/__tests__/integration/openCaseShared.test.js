process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const Transaction = require("../../models/Transaction");
const Roll = require("../../models/Roll");
const realtime = require("../../utils/realtime");
const { openCase } = require("../../games/openCase");
const { recomputeCaseValues } = require("../../utils/itemValue");

beforeAll(setupDb);
afterEach(async () => {
  realtime.setIo(null);
  await clearDb();
});
afterAll(teardownDb);

// a stand-in that keeps what was announced, so the live feed can be asserted on
function captureIo() {
  const emitted = [];
  const rooms = [];
  realtime.setIo({
    emit: (event, payload) => emitted.push({ event, payload }),
    to: (room) => ({ emit: (event, payload) => rooms.push({ room, event, payload }) }),
  });
  return { emitted, rooms };
}

async function makeCase(price = 100) {
  const s = uniqueSuffix();
  const items = await Item.create([
    { name: `common-${s}`, image: "c.png", rarity: "1", baseValue: 10 },
    { name: `rare-${s}`, image: "r.png", rarity: "5", baseValue: 900 },
  ]);
  const one = await Case.create({
    title: `case-${s}`,
    image: "case.png",
    price,
    category: "Touhou",
    items: items.map((item) => item._id),
  });
  await recomputeCaseValues(one._id);
  return Case.findById(one._id);
}

async function makeUser(walletBalance = 10000) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    walletBalance,
  });
}

// the route hands this a user document without its inventory, so the tests do too:
// reading one back in here is what the shared path must never start doing
const asCaller = (user) => User.findById(user._id).select({ password: 0, inventory: 0 });

describe("the shared opening", () => {
  it("charges, hands the item over and writes one ledger row", async () => {
    const one = await makeCase(250);
    const user = await makeUser(1000);

    const result = await openCase({ user: await asCaller(user), caseId: one._id, quantity: 2 });

    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.cost).toBe(500);
    expect(result.walletBalance).toBe(500);

    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(500);
    expect(after.inventory).toHaveLength(2);
    expect(after.xp).toBe(2500);

    const ledger = await Transaction.find({ userId: user._id }).lean();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ direction: "debit", amount: 500, balanceAfter: 500 });
  });

  it("refuses when the balance will not cover it, and charges nothing", async () => {
    const one = await makeCase(900);
    const user = await makeUser(100);

    const result = await openCase({ user: await asCaller(user), caseId: one._id, quantity: 1 });

    expect(result).toMatchObject({ ok: false, status: 400 });
    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(100);
    expect(after.inventory).toHaveLength(0);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(0);
  });

  it("writes one provably-fair roll per opening, tied to the item it produced", async () => {
    const one = await makeCase(10);
    const user = await makeUser(1000);

    const result = await openCase({ user: await asCaller(user), caseId: one._id, quantity: 3 });

    const rolls = await Roll.find({ userId: user._id }).sort({ nonce: 1 }).lean();
    expect(rolls).toHaveLength(3);
    expect(rolls.map((r) => r.rollId)).toEqual(result.rollIds);
    expect(new Set(rolls.map((r) => r.nonce)).size).toBe(3);
    for (const [index, roll] of rolls.entries()) {
      expect(roll.game).toBe("case");
      expect(roll.uniqueId).toBe(result.items[index].uniqueId);
    }
  });

  it("holds the quantity between one and five", async () => {
    const one = await makeCase(10);
    const caller = await asCaller(await makeUser());
    for (const quantity of [0, -1, 6, 2.5, "2"]) {
      expect((await openCase({ user: caller, caseId: one._id, quantity })).ok).toBe(false);
    }
  });
});

describe("what the live feed is told", () => {
  it("announces the drop, and says nothing about a source when there is none", async () => {
    const io = captureIo();
    const one = await makeCase(100);
    const user = await makeUser();

    await openCase({ user: await asCaller(user), caseId: one._id, quantity: 1 });

    const drop = io.emitted.find((e) => e.event === "caseOpened");
    expect(drop).toBeTruthy();
    expect(drop.payload.winningItems).toHaveLength(1);
    expect(drop.payload.user).toMatchObject({ name: expect.any(String), id: user._id });
    expect(drop.payload.caseImage).toBe("case.png");
    expect("source" in drop.payload).toBe(false);
  });

  // the ticker paints a marker off this, the way it already does for an upgrade
  it("carries the source through when the opening came from somewhere else", async () => {
    const io = captureIo();
    const one = await makeCase(100);
    const user = await makeUser();

    await openCase({ user: await asCaller(user), caseId: one._id, quantity: 1, source: "discord" });

    const drop = io.emitted.find((e) => e.event === "caseOpened");
    expect(drop.payload.source).toBe("discord");
  });

  it("tells the opener's own sockets their new balance", async () => {
    const io = captureIo();
    const one = await makeCase(300);
    const user = await makeUser(1000);

    await openCase({ user: await asCaller(user), caseId: one._id, quantity: 1 });

    const mine = io.rooms.find((r) => r.event === "userDataUpdated");
    expect(mine.room).toBe(String(user._id));
    expect(mine.payload).toMatchObject({ walletBalance: 700 });
  });

  it("opens fine with no socket server attached at all", async () => {
    realtime.setIo(null);
    const one = await makeCase(100);
    const user = await makeUser();

    const result = await openCase({ user: await asCaller(user), caseId: one._id, quantity: 1 });
    expect(result.ok).toBe(true);
  });
});
