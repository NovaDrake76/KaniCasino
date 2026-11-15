process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// a charge or a payout that loses its write, for the 503 answer and the settlement that has to resume
let mockFailCharge = false;
let mockFailCreditFor = null;
jest.mock("../../utils/economy", () => {
  const actual = jest.requireActual("../../utils/economy");
  return {
    ...actual,
    chargeUser: (...args) => (mockFailCharge ? Promise.resolve(null) : actual.chargeUser(...args)),
    creditUser: (userId, ...rest) => {
      if (mockFailCreditFor && String(userId) === mockFailCreditFor) {
        mockFailCreditFor = null;
        return Promise.resolve(null);
      }
      return actual.creditUser(userId, ...rest);
    },
  };
});

const express = require("express");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { tokenFor, uniqueSuffix } = require("./helpers");
const lotteryRoutes = require("../../routes/lotteryRoutes");
const fairRoutes = require("../../routes/fairRoutes");
const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const Notification = require("../../models/Notification");
const LotteryDraw = require("../../models/LotteryDraw");
const LotteryTicket = require("../../models/LotteryTicket");
const LotteryEntry = require("../../models/LotteryEntry");
const { TX } = require("../../utils/economy");
const { HOUSE } = require("../../utils/accounts");
const { hashServerSeed } = require("../../utils/provablyFair");
const { drawNumbers, JACKPOT_BASE, JACKPOT_SHARE } = require("../../utils/lotteryMath");
const lottery = require("../../games/lottery");
const { settleDue } = require("../../games/lotteryDraw");
const memo = require("../../utils/memo");

let emitted = [];
const io = {
  emit: (event, payload) => emitted.push({ to: null, event, payload }),
  to: (room) => ({ emit: (event, payload) => emitted.push({ to: String(room), event, payload }) }),
};

let app;
beforeAll(async () => {
  await setupDb();
  app = express();
  app.use(express.json());
  app.use("/lottery", lotteryRoutes(io));
  app.use("/fair", fairRoutes);
});
beforeEach(async () => {
  emitted = [];
  // on sale for an hour, whatever the clock says
  await lottery.ensureOpenDraw();
  await LotteryDraw.updateOne({ number: 1 }, { $set: { drawAt: new Date(Date.now() + 3600 * 1000) } });
});
afterEach(async () => {
  mockFailCharge = false;
  mockFailCreditFor = null;
  jest.restoreAllMocks();
  delete process.env.VERIFY_REQUIRED_FROM_SAVED;
  await clearDb();
});
afterAll(teardownDb);

const makeUser = (overrides = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `l-${s}`, email: `l-${s}@e.com`, password: "x", walletBalance: 50000, ...overrides });
};
const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const buy = (user, picks) => auth(request(app).post("/lottery/tickets"), user).send({ picks });
const balanceOf = async (user) => (await User.findById(user._id)).walletBalance;
const rowsOf = (user, type) => Transaction.find({ userId: user._id, type }).lean();
const seedOf = async (number) => (await LotteryDraw.findOne({ number }).select("+serverSeed").lean()).serverSeed;

// pin a draw's seed so the numbers are known, and hand back a ticket for each tier
async function pinDraw(number, seed = `seed-${uniqueSuffix()}`) {
  await LotteryDraw.updateOne({ number }, { $set: { serverSeed: seed, seedHash: hashServerSeed(seed) } });
  const [a, b, c] = drawNumbers(seed, number);
  const o = Array.from({ length: 20 }, (_, i) => i + 1).filter((n) => ![a, b, c].includes(n));
  return { numbers: [a, b, c], m3: [a, b, c], m2: [a, b, o[0]], m1: [a, o[0], o[1]], m0: [o[0], o[1], o[2]] };
}

const due = (number) => LotteryDraw.updateOne({ number }, { $set: { drawAt: new Date(Date.now() - 1000) } });

describe("buying tickets", () => {
  it("charges once, writes one ledger row, and grows the pot and the counts", async () => {
    const user = await makeUser();
    const res = await buy(user, [[19, 3, 7], [1, 2, 3]]);
    expect(res.status).toBe(200);
    expect(res.body.tickets).toEqual([{ numbers: [3, 7, 19] }, { numbers: [1, 2, 3] }]);
    expect(res.body.balance).toBe(49800);
    expect(res.body.draw).toEqual({ number: 1, jackpot: JACKPOT_BASE + 2 * JACKPOT_SHARE, tickets: 2 });
    expect(res.body.me).toEqual({ count: 2, left: 48 });

    expect(await balanceOf(user)).toBe(49800);
    const rows = await rowsOf(user, TX.LOTTERY_TICKET);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 200, direction: "debit", meta: { draw: 1, quantity: 2 } });
    expect(String(rows[0].counterparty)).toBe(String(HOUSE));

    const draw = await LotteryDraw.findOne({ number: 1 }).lean();
    expect(draw.jackpot).toBe(JACKPOT_BASE + 2 * JACKPOT_SHARE);
    expect(draw.tickets).toBe(2);
    const tickets = await LotteryTicket.find({ userId: user._id }).sort({ _id: 1 }).lean();
    expect(tickets.map((t) => t.numbers)).toEqual([[3, 7, 19], [1, 2, 3]]);
    expect(tickets.every((t) => t.draw === 1 && t.matches === null)).toBe(true);

    expect(emitted).toEqual(
      expect.arrayContaining([
        { to: null, event: "lottery:pot", payload: { draw: 1, jackpot: JACKPOT_BASE + 2 * JACKPOT_SHARE, tickets: 2 } },
        expect.objectContaining({ to: String(user._id), event: "userDataUpdated", payload: expect.objectContaining({ walletBalance: 49800 }) }),
      ])
    );
  });

  it("earns the stake's xp like any bet", async () => {
    const user = await makeUser({ xp: 0 });
    await buy(user, [[1, 2, 3]]);
    expect((await User.findById(user._id)).xp).toBe(500);
  });

  it("stops at fifty tickets in one draw", async () => {
    const user = await makeUser();
    expect((await buy(user, Array.from({ length: 50 }, () => [1, 2, 3]))).status).toBe(200);
    const over = await buy(user, [[4, 5, 6]]);
    expect(over.status).toBe(409);
    expect(over.body.reason).toBe("cap");
    expect(await LotteryTicket.countDocuments({ userId: user._id })).toBe(50);
    expect(await balanceOf(user)).toBe(45000);
  });

  it("holds the cap when two purchases race, even past the one-at-a-time lane", async () => {
    const user = await makeUser();
    const picks = Array.from({ length: 30 }, () => [1, 2, 3]);
    const results = await Promise.all([1, 2].map(() => lottery.buyTickets({ user, picks, io })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await LotteryTicket.countDocuments({ userId: user._id })).toBe(30);
    expect(await balanceOf(user)).toBe(47000);
    expect((await LotteryEntry.findOne({ userId: user._id }).lean()).count).toBe(30);

    // two first purchases that fit together both land
    const other = await makeUser();
    const both = await Promise.all([1, 2].map(() => lottery.buyTickets({ user: other, picks: picks.slice(0, 20), io })));
    expect(both.map((r) => r.status)).toEqual([200, 200]);
    expect(await LotteryTicket.countDocuments({ userId: other._id })).toBe(40);
  });

  it("holds the cap for two requests sent at once over http", async () => {
    const user = await makeUser();
    const picks = Array.from({ length: 30 }, () => [1, 2, 3]);
    const results = await Promise.all([buy(user, picks), buy(user, picks)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await LotteryTicket.countDocuments({ userId: user._id })).toBe(30);
  });

  it("refuses once sales have closed, a minute before the draw", async () => {
    const user = await makeUser();
    await LotteryDraw.updateOne({ number: 1 }, { $set: { drawAt: new Date(Date.now() + 30 * 1000) } });
    const res = await buy(user, [[1, 2, 3]]);
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe("closed");
    expect(await balanceOf(user)).toBe(50000);
    expect(await LotteryEntry.countDocuments({})).toBe(0);
  });

  it("refuses a pick that is not three different numbers from 1 to 20, and charges nothing", async () => {
    const user = await makeUser();
    for (const picks of [[[1, 1, 2]], [], [[0, 1, 2]], [[1, 2, 21]], [[1, 2]], Array.from({ length: 51 }, () => [1, 2, 3]), "1,2,3", [[1, 2, 3], [5, 5, 6]]]) {
      const res = await buy(user, picks);
      expect(res.status).toBe(400);
      expect(res.body.reason).toBe("picks");
    }
    expect(await balanceOf(user)).toBe(50000);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(0);
  });

  it("needs a verified account once the lock date has passed, like the market, and refuses a limited one", async () => {
    const saved = process.env.VERIFY_REQUIRED_FROM;
    process.env.VERIFY_REQUIRED_FROM = "2000-01-01T00:00:00Z";
    try {
      const unverified = await makeUser();
      const res = await buy(unverified, [[1, 2, 3]]);
      expect(res.status).toBe(403);
      expect(res.body.reason).toBe("verify");
      expect(await balanceOf(unverified)).toBe(50000);

      const verified = await makeUser({ googleId: `g-${uniqueSuffix()}` });
      expect((await buy(verified, [[1, 2, 3]])).status).toBe(200);

      const limited = await makeUser({ googleId: `g-${uniqueSuffix()}`, limited: { at: new Date(), reason: "alt" } });
      const refused = await buy(limited, [[1, 2, 3]]);
      expect(refused.status).toBe(403);
      expect(refused.body.reason).toBe("limited");
    } finally {
      process.env.VERIFY_REQUIRED_FROM = saved;
    }
  });

  it("says insufficient balance on an empty wallet and gives the cap back", async () => {
    const user = await makeUser({ walletBalance: 150 });
    const res = await buy(user, [[1, 2, 3], [4, 5, 6]]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient/i);
    expect((await LotteryEntry.findOne({ userId: user._id }).lean()).count).toBe(0);
    expect((await buy(user, [[1, 2, 3]])).status).toBe(200);
  });

  it("says try again when a funded wallet's charge is lost", async () => {
    const user = await makeUser();
    mockFailCharge = true;
    const res = await buy(user, [[1, 2, 3]]);
    expect(res.status).toBe(503);
    expect(res.body.message).not.toMatch(/insufficient/i);
    expect((await LotteryEntry.findOne({ userId: user._id }).lean()).count).toBe(0);
    expect(await LotteryTicket.countDocuments({})).toBe(0);
  });

  it("refunds a purchase whose draw closed between the charge and the tickets", async () => {
    const user = await makeUser();
    const real = LotteryDraw.findOneAndUpdate.bind(LotteryDraw);
    jest.spyOn(LotteryDraw, "findOneAndUpdate").mockImplementation((filter, ...rest) => {
      // the settlement switches the draw to drawing in the gap
      if (filter && filter.status === "open" && filter.number === 1) {
        return { lean: () => real({ number: 1, status: "open" }, { $set: { status: "drawing" } }, { new: true }).lean().then(() => null) };
      }
      return real(filter, ...rest);
    });
    const res = await buy(user, [[1, 2, 3], [4, 5, 6]]);
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe("closed");
    expect(await balanceOf(user)).toBe(50000);
    const refunds = await rowsOf(user, TX.LOTTERY_REFUND);
    expect(refunds.map((r) => r.amount)).toEqual([200]);
    expect(await LotteryTicket.countDocuments({})).toBe(0);
    expect((await LotteryEntry.findOne({ userId: user._id }).lean()).count).toBe(0);
    expect((await LotteryDraw.findOne({ number: 1 }).lean()).jackpot).toBe(JACKPOT_BASE);
  });

  it("says try again, not sales closed, when the tickets cannot be written while the draw is still on sale", async () => {
    const user = await makeUser();
    jest.spyOn(LotteryTicket, "insertMany").mockRejectedValueOnce(new Error("write failed"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    const res = await buy(user, [[1, 2, 3]]);
    expect(res.status).toBe(503);
    expect(res.body.reason).toBe("busy");
    expect(await balanceOf(user)).toBe(50000);
    expect((await rowsOf(user, TX.LOTTERY_REFUND)).map((r) => r.amount)).toEqual([100]);
    expect(await LotteryTicket.countDocuments({})).toBe(0);
    expect((await LotteryEntry.findOne({ userId: user._id }).lean()).count).toBe(0);
    expect((await LotteryDraw.findOne({ number: 1 }).lean()).jackpot).toBe(JACKPOT_BASE);
    // and the same player can buy straight after
    expect((await buy(user, [[1, 2, 3]])).status).toBe(200);
  });
});

describe("the seed", () => {
  it("never leaves the server while the draw is on sale, and is revealed once it is settled", async () => {
    const user = await makeUser();
    const seed = await seedOf(1);
    const bought = await buy(user, [[1, 2, 3]]);
    const answers = [
      bought,
      await request(app).get("/lottery"),
      await auth(request(app).get("/lottery"), user),
      await request(app).get("/lottery/draws"),
      await auth(request(app).get("/lottery/draws/1/tickets"), user),
      await request(app).get("/fair/lottery/1"),
    ];
    for (const res of answers) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(seed);
    }
    expect(JSON.stringify(emitted)).not.toContain(seed);
    expect(answers[1].body.draw.seedHash).toBe(hashServerSeed(seed));
    expect(answers[5].body).toEqual({ number: 1, status: "open", seedHash: hashServerSeed(seed), revealed: false });

    await due(1);
    emitted = [];
    await settleDue(io, { revealMs: 0 });
    const nextSeed = await seedOf(2);
    expect(JSON.stringify(emitted)).not.toContain(nextSeed);
    expect(JSON.stringify(emitted)).not.toContain(seed);
    for (const res of [await request(app).get("/lottery"), await request(app).get("/lottery/draws"), await request(app).get("/fair/lottery/2")]) {
      expect(JSON.stringify(res.body)).not.toContain(nextSeed);
    }

    const verify = await request(app).get("/fair/lottery/1");
    expect(verify.body).toMatchObject({ revealed: true, serverSeed: seed, commitmentValid: true, outcomeValid: true });
    expect(verify.body.recomputedNumbers).toEqual(drawNumbers(seed, 1));
    expect((await request(app).get("/lottery")).body.last.serverSeed).toBe(seed);
  });
});

describe("the draw", () => {
  it("pays every tier, one credit per player, and opens the next draw at the base", async () => {
    const [a, b, c, d] = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()]);
    const t = await pinDraw(1);
    await buy(a, [t.m3, t.m0]);
    await buy(b, [t.m2, t.m1]);
    await buy(c, [t.m1]);
    await buy(d, [t.m0]);
    const jackpot = JACKPOT_BASE + JACKPOT_SHARE * 6;
    await due(1);
    emitted = [];

    const result = await settleDue(io, { revealMs: 0 });
    expect(result).toMatchObject({ number: 1, numbers: t.numbers, jackpot, jackpotEach: jackpot, winners: { m1: 2, m2: 1, m3: 1 }, paid: 3 });

    const draw = await LotteryDraw.findOne({ number: 1 }).lean();
    expect(draw.status).toBe("settled");
    expect(draw.numbers).toEqual(t.numbers);
    expect(draw.winners).toEqual({ m1: 2, m2: 1, m3: 1 });
    expect(draw.jackpotWinners.map((w) => w.username)).toEqual([a.username]);
    expect(draw.settledAt).toBeTruthy();

    const winsOf = async (u) => (await rowsOf(u, TX.LOTTERY_WIN)).map((r) => ({ amount: r.amount, meta: r.meta }));
    expect(await winsOf(a)).toEqual([{ amount: jackpot, meta: { draw: 1, tickets: 2, matched: { 1: 0, 2: 0, 3: 1 }, jackpot } }]);
    expect(await winsOf(b)).toEqual([{ amount: 400, meta: { draw: 1, tickets: 2, matched: { 1: 1, 2: 1, 3: 0 }, jackpot: 0 } }]);
    expect(await winsOf(c)).toEqual([{ amount: 100, meta: { draw: 1, tickets: 1, matched: { 1: 1, 2: 0, 3: 0 }, jackpot: 0 } }]);
    expect(await winsOf(d)).toEqual([]);
    expect(await balanceOf(a)).toBe(50000 - 200 + jackpot);
    expect(await balanceOf(b)).toBe(50000 - 200 + 400);
    expect(await balanceOf(d)).toBe(50000 - 100);
    expect(String((await rowsOf(a, TX.LOTTERY_WIN))[0].counterparty)).toBe(String(HOUSE));

    const scored = await LotteryTicket.find({ userId: b._id }).sort({ _id: 1 }).lean();
    expect(scored.map((x) => [x.matches, x.prize])).toEqual([[2, 300], [1, 100]]);

    const notes = await Notification.find({}).lean();
    expect(notes.map((n) => String(n.receiverId)).sort()).toEqual([a, b, c].map((u) => String(u._id)).sort());
    expect(notes.find((n) => String(n.receiverId) === String(a._id)).content).toMatch(/jackpot.*#1/);
    expect(notes.find((n) => String(n.receiverId) === String(b._id)).content).toBe("You won 400 K₽ in lottery draw #1.");

    const next = await LotteryDraw.findOne({ number: 2 }).lean();
    expect(next).toMatchObject({ status: "open", jackpot: JACKPOT_BASE, carried: 0, tickets: 0 });
    expect(new Date(next.drawAt).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(next.drawAt).getUTCHours()).toBe(20);

    const drawn = emitted.find((e) => e.event === "lottery:drawn");
    expect(drawn.payload).toMatchObject({ number: 1, numbers: t.numbers, jackpot, jackpotWinners: [{ username: a.username, tickets: 1 }], next: { number: 2, jackpot: JACKPOT_BASE } });
    const pushedTo = emitted.filter((e) => e.event === "userDataUpdated").map((e) => e.to).sort();
    expect(pushedTo).toEqual([a, b, c].map((u) => String(u._id)).sort());
    expect(emitted.find((e) => e.event === "userDataUpdated" && e.to === String(b._id)).payload.walletBalance).toBe(50200);
  });

  it("does not name a disabled account among the jackpot winners, and still pays it", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const t = await pinDraw(1);
    await buy(a, [t.m3]);
    await buy(b, [t.m3]);
    await User.updateOne({ _id: a._id }, { $set: { disabled: true } });
    await due(1);
    const result = await settleDue(io, { revealMs: 0 });
    expect(result.paid).toBe(2);
    expect(result.jackpotWinners.map((w) => w.username).sort()).toEqual([b.username, "player"].sort());
    const draw = await LotteryDraw.findOne({ number: 1 }).lean();
    expect(draw.jackpotWinners.map((w) => w.username).sort()).toEqual([b.username, "player"].sort());
  });

  it("splits the jackpot equally between winning tickets and keeps the remainder", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const t = await pinDraw(1);
    await buy(a, [t.m3, t.m3]);
    await buy(b, [t.m3]);
    const jackpot = JACKPOT_BASE + 3 * JACKPOT_SHARE;
    await due(1);
    const result = await settleDue(io, { revealMs: 0 });
    const each = Math.floor(jackpot / 3);
    expect(result.jackpotEach).toBe(each);
    expect((await rowsOf(a, TX.LOTTERY_WIN)).map((r) => r.amount)).toEqual([2 * each]);
    expect((await rowsOf(b, TX.LOTTERY_WIN)).map((r) => r.amount)).toEqual([each]);
    const draw = await LotteryDraw.findOne({ number: 1 }).lean();
    expect(draw.jackpotWinners.map((w) => [w.username, w.tickets]).sort()).toEqual([[a.username, 2], [b.username, 1]].sort());
    expect((await LotteryDraw.findOne({ number: 2 }).lean()).jackpot).toBe(JACKPOT_BASE);
  });

  it("rolls the whole jackpot into the next draw when nobody matches three", async () => {
    const user = await makeUser();
    const t = await pinDraw(1);
    await buy(user, [t.m2, t.m0]);
    await due(1);
    await settleDue(io, { revealMs: 0 });
    const second = await LotteryDraw.findOne({ number: 2 }).lean();
    expect(second).toMatchObject({ jackpot: JACKPOT_BASE + 2 * JACKPOT_SHARE, carried: 1 });

    await LotteryDraw.updateOne({ number: 2 }, { $set: { drawAt: new Date(Date.now() + 3600 * 1000) } });
    const t2 = await pinDraw(2);
    await buy(user, [t2.m1]);
    await due(2);
    await settleDue(io, { revealMs: 0 });
    expect(await LotteryDraw.findOne({ number: 3 }).lean()).toMatchObject({ jackpot: JACKPOT_BASE + 3 * JACKPOT_SHARE, carried: 2 });
  });

  it("still draws with no tickets sold, and rolls over", async () => {
    await due(1);
    const result = await settleDue(io, { revealMs: 0 });
    expect(result).toMatchObject({ number: 1, paid: 0, winners: { m1: 0, m2: 0, m3: 0 } });
    const draw = await LotteryDraw.findOne({ number: 1 }).lean();
    expect(draw.status).toBe("settled");
    expect(draw.numbers).toHaveLength(3);
    expect(await LotteryDraw.findOne({ number: 2 }).lean()).toMatchObject({ jackpot: JACKPOT_BASE, carried: 1 });
  });

  it("does nothing before the draw is due", async () => {
    expect(await settleDue(io, { revealMs: 0 })).toBeNull();
    expect((await LotteryDraw.findOne({ number: 1 }).lean()).status).toBe("open");
  });

  it("pays exactly once when it runs twice, one after the other or at the same time", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const t = await pinDraw(1);
    await buy(a, [t.m2]);
    await buy(b, [t.m1]);
    await due(1);
    const [first, second] = await Promise.all([settleDue(io, { revealMs: 0 }), settleDue(io, { revealMs: 0 })]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(await settleDue(io, { revealMs: 0 })).toBeNull();
    expect((await rowsOf(a, TX.LOTTERY_WIN)).map((r) => r.amount)).toEqual([300]);
    expect((await rowsOf(b, TX.LOTTERY_WIN)).map((r) => r.amount)).toEqual([100]);
    expect(await LotteryDraw.countDocuments({})).toBe(2);
    expect(await Notification.countDocuments({})).toBe(2);
  });

  it("resumes after a payout fails halfway and pays everyone exactly once", async () => {
    const [a, b, c] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const t = await pinDraw(1);
    await buy(a, [t.m2]);
    await buy(b, [t.m2, t.m1]);
    await buy(c, [t.m1]);
    await due(1);

    mockFailCreditFor = String(b._id);
    jest.spyOn(console, "error").mockImplementation(() => {});
    const failed = await settleDue(io, { revealMs: 0 });
    expect(failed.error).toBeTruthy();
    const stuck = await LotteryDraw.findOne({ number: 1 }).lean();
    expect(stuck.status).toBe("drawing");
    expect(stuck.lockedAt).toBeUndefined();
    expect((await LotteryEntry.findOne({ userId: b._id }).lean()).paid).toBe(false);
    expect(await LotteryDraw.countDocuments({})).toBe(1);
    // the public page says it is being drawn and still hides the numbers
    const page = await request(app).get("/lottery");
    expect(page.body.draw).toMatchObject({ number: 1, status: "drawing" });
    expect(page.body.draw.numbers).toBeUndefined();

    const resumed = await settleDue(io, { revealMs: 0 });
    expect(resumed.error).toBeUndefined();
    expect((await rowsOf(a, TX.LOTTERY_WIN)).map((r) => r.amount)).toEqual([300]);
    expect((await rowsOf(b, TX.LOTTERY_WIN)).map((r) => r.amount)).toEqual([400]);
    expect((await rowsOf(c, TX.LOTTERY_WIN)).map((r) => r.amount)).toEqual([100]);
    expect(await balanceOf(b)).toBe(50000 - 200 + 400);
    expect((await LotteryDraw.findOne({ number: 1 }).lean()).status).toBe("settled");
    expect(await LotteryDraw.countDocuments({ number: 2 })).toBe(1);
    expect(await Notification.countDocuments({})).toBe(3);
  });

  it("picks up a run that died after paying, without paying again, and opens the next draw once", async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const t = await pinDraw(1);
    await buy(a, [t.m3]);
    await buy(b, [t.m2]);
    await due(1);
    await settleDue(io, { revealMs: 0 });
    const paidA = await balanceOf(a);
    const paidB = await balanceOf(b);

    // what a process dying after the payouts and before the settled write would leave
    await LotteryDraw.deleteOne({ number: 2 });
    await LotteryDraw.updateOne({ number: 1 }, { $set: { status: "drawing", lockedAt: new Date() }, $unset: { settledAt: 1 } });
    // a lease that is still fresh belongs to a run that may be alive
    expect(await settleDue(io, { revealMs: 0 })).toBeNull();

    await LotteryDraw.updateOne({ number: 1 }, { $set: { lockedAt: new Date(Date.now() - 10 * 60 * 1000) } });
    const resumed = await settleDue(io, { revealMs: 0 });
    expect(resumed).toMatchObject({ number: 1, paid: 0, next: 2 });
    expect(await balanceOf(a)).toBe(paidA);
    expect(await balanceOf(b)).toBe(paidB);
    expect(await Transaction.countDocuments({ type: TX.LOTTERY_WIN })).toBe(2);
    expect(await Notification.countDocuments({})).toBe(2);
    expect(await LotteryDraw.findOne({ number: 2 }).lean()).toMatchObject({ status: "open", jackpot: JACKPOT_BASE, carried: 0 });
  });

  it("opens the next draw when a run died between settling and opening it", async () => {
    await due(1);
    await settleDue(io, { revealMs: 0 });
    await LotteryDraw.deleteOne({ number: 2 });
    expect(await settleDue(io, { revealMs: 0 })).toBeNull();
    expect(await LotteryDraw.findOne({ number: 2 }).lean()).toMatchObject({ status: "open", carried: 1 });
  });
});

describe("the home tile's pot", () => {
  it("answers anyone with the open draw's number, jackpot and time, and moves with a purchase", async () => {
    const res = await request(app).get("/lottery/pot");
    expect(res.status).toBe(200);
    const open = await LotteryDraw.findOne({ number: 1 }).lean();
    expect(res.body).toEqual({ number: 1, jackpot: JACKPOT_BASE, drawAt: open.drawAt.toISOString(), serverTime: expect.any(String) });

    const user = await makeUser();
    await buy(user, [[1, 2, 3], [4, 5, 6]]);
    const signedIn = await auth(request(app).get("/lottery/pot"), user);
    expect(signedIn.body).toEqual({
      number: 1,
      jackpot: JACKPOT_BASE + 2 * JACKPOT_SHARE,
      drawAt: open.drawAt.toISOString(),
      serverTime: expect.any(String),
    });
  });

  it("serves the cached draw, so a second ask does not reach the database", async () => {
    await request(app).get("/lottery/pot");
    const reads = jest.spyOn(LotteryDraw, "findOne");
    const again = await request(app).get("/lottery/pot");
    expect(again.body.number).toBe(1);
    expect(reads).not.toHaveBeenCalled();
  });

  it("stamps the time of each answer, not the time the draw was cached", async () => {
    const first = await request(app).get("/lottery/pot");
    await new Promise((resolve) => setTimeout(resolve, 30));
    const before = Date.now();
    const reads = jest.spyOn(LotteryDraw, "findOne");
    const second = await request(app).get("/lottery/pot");
    expect(reads).not.toHaveBeenCalled();
    const at = Date.parse(second.body.serverTime);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
    expect(at).toBeGreaterThan(Date.parse(first.body.serverTime));
  });

  it("follows the draw to the next one once it is settled", async () => {
    const user = await makeUser();
    const t = await pinDraw(1);
    await buy(user, [t.m0]);
    await due(1);
    await settleDue(io, { revealMs: 0 });
    const res = await request(app).get("/lottery/pot");
    expect(res.body).toMatchObject({ number: 2, jackpot: JACKPOT_BASE + JACKPOT_SHARE });
  });

  it("answers null when there is no open draw", async () => {
    await LotteryDraw.deleteMany({});
    memo.forget("lottery:");
    const res = await request(app).get("/lottery/pot");
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
    expect(await LotteryDraw.countDocuments({})).toBe(0);
  });
});

describe("the page and the history", () => {
  it("shows a guest the draw, the rules and the last result", async () => {
    const res = await request(app).get("/lottery");
    expect(res.status).toBe(200);
    expect(res.body.draw).toMatchObject({ number: 1, status: "open", jackpot: JACKPOT_BASE, tickets: 0, carried: 0 });
    expect(new Date(res.body.draw.salesCloseAt).getTime()).toBe(new Date(res.body.draw.drawAt).getTime() - 60 * 1000);
    expect(res.body.rules).toMatchObject({ pool: 20, pick: 3, price: 100, cap: 50, drawHourUtc: 20, prizes: { 1: 100, 2: 300 }, jackpotBase: 25000, jackpotShare: 25 });
    expect(res.body.last).toBeNull();
    expect(res.body.me).toBeNull();
    expect(res.body.serverTime).toBeTruthy();
  });

  it("shows a player their tickets in the open draw and what the last one paid them", async () => {
    const user = await makeUser();
    const t = await pinDraw(1);
    await buy(user, [t.m2, t.m0]);
    await due(1);
    await settleDue(io, { revealMs: 0 });
    await LotteryDraw.updateOne({ number: 2 }, { $set: { drawAt: new Date(Date.now() + 3600 * 1000) } });
    await buy(user, [[1, 2, 3], [4, 5, 6], [7, 8, 9]]);

    const res = await auth(request(app).get("/lottery"), user);
    expect(res.body.draw).toMatchObject({ number: 2, tickets: 3 });
    expect(res.body.me).toMatchObject({ count: 3, left: 47 });
    expect(res.body.me.tickets.map((x) => x.numbers)).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    expect(res.body.me.last).toEqual({
      number: 1,
      won: 300,
      tickets: [{ numbers: [...t.m2].sort((x, y) => x - y), matches: 2, prize: 300 }, { numbers: [...t.m0].sort((x, y) => x - y), matches: 0, prize: 0 }],
    });
    expect(res.body.last).toMatchObject({ number: 1, numbers: t.numbers, winners: { m1: 0, m2: 1, m3: 0 }, jackpotWinners: [] });
  });

  it("pages the settled draws newest first with what verifying needs, and a player's own tickets in one", async () => {
    const [me, other] = await Promise.all([makeUser(), makeUser()]);
    await buy(me, [[1, 2, 3]]);
    await buy(other, [[4, 5, 6]]);
    for (let n = 1; n <= 11; n++) {
      await due(n);
      await settleDue(io, { revealMs: 0 });
    }
    const first = await request(app).get("/lottery/draws");
    expect(first.body.page).toBe(1);
    expect(first.body.pages).toBe(2);
    expect(first.body.draws.map((d) => d.number)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    for (const d of first.body.draws) {
      expect(hashServerSeed(d.serverSeed)).toBe(d.seedHash);
      expect(drawNumbers(d.serverSeed, d.number)).toEqual(d.numbers);
    }
    const second = await request(app).get("/lottery/draws?page=2");
    expect(second.body.draws.map((d) => d.number)).toEqual([1]);
    expect(second.body.draws[0].tickets).toBe(2);

    const mine = await auth(request(app).get("/lottery/draws/1/tickets"), me);
    expect(mine.status).toBe(200);
    expect(mine.body.tickets.map((x) => x.numbers)).toEqual([[1, 2, 3]]);
    expect(mine.body.numbers).toHaveLength(3);
    expect((await auth(request(app).get("/lottery/draws/99/tickets"), me)).status).toBe(404);
    expect((await request(app).get("/lottery/draws/1/tickets")).status).toBe(401);
  });
});
