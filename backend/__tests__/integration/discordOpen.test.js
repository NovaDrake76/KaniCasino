process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DISCORD_BOT_SECRET = "bot-secret-for-tests";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const Roll = require("../../models/Roll");
const Transaction = require("../../models/Transaction");
const DiscordOpen = require("../../models/DiscordOpen");
const realtime = require("../../utils/realtime");
const { recomputeCaseValues } = require("../../utils/itemValue");

const SECRET = process.env.DISCORD_BOT_SECRET;
const DISCORD_EPOCH = 1420070400000;

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(async () => {
  realtime.setIo(null);
  await clearDb();
});
afterAll(teardownDb);

const snowflakeFor = (date) => String(BigInt(date.getTime() - DISCORD_EPOCH) << 22n);
const oldEnough = () => snowflakeFor(new Date(Date.now() - 400 * 86400000));
const bot = (req) => req.set("x-bot-secret", SECRET);

let ticket = 0;
const interaction = () => `interaction-${(ticket += 1)}-${uniqueSuffix()}`;

async function makeUser(walletBalance = 5000) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    walletBalance,
  });
}

// the bot's own flow, so the link is real rather than written straight onto the document
async function linkUser(user, discordId) {
  const started = await bot(request(app).post("/discord/link/start")).send({ discordId, discordName: "someone" });
  const jwt = require("jsonwebtoken");
  const token = jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "1h" });
  await request(app)
    .post("/discord/link/complete")
    .set("Authorization", `Bearer ${token}`)
    .send({ code: started.body.code });
}

async function makeCase(price = 100, title) {
  const s = uniqueSuffix();
  const items = await Item.create([
    { name: `cheap-${s}`, image: "c.png", rarity: "1", baseValue: 10 },
    { name: `dear-${s}`, image: "d.png", rarity: "5", baseValue: 900 },
  ]);
  const one = await Case.create({
    title: title || `case-${s}`,
    image: "case.png",
    price,
    category: "Touhou",
    items: items.map((item) => item._id),
  });
  await recomputeCaseValues(one._id);
  return one;
}

const open = (body) => bot(request(app).post("/discord/open")).send(body);

// the money itself runs through games/openCase.js, the same path the site uses. what is
// tested here is everything wrapped around it.
describe("opening a case from discord", () => {
  it("charges the linked account and hands the items over", async () => {
    const user = await makeUser(5000);
    const discordId = oldEnough();
    await linkUser(user, discordId);
    const one = await makeCase(300);

    const res = await open({ discordId, interactionId: interaction(), caseId: one._id, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.cost).toBe(600);
    expect(res.body.walletBalance).toBe(4400);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].rollId).toEqual(expect.any(String));
    // the bot paints the prize by this, and a missing one renders as plain white
    expect(res.body.items[0].rarity).toMatch(/^[1-5]$/);
    expect(res.body.reel[0]).toMatchObject({ name: expect.any(String), rarity: expect.stringMatching(/^[1-5]$/) });

    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(4400);
    expect(after.inventory).toHaveLength(2);
  });

  it("marks the drop as having come from discord", async () => {
    const emitted = [];
    realtime.setIo({ emit: (event, payload) => emitted.push({ event, payload }), to: () => ({ emit: () => {} }) });

    const user = await makeUser();
    const discordId = oldEnough();
    await linkUser(user, discordId);
    const one = await makeCase(100);
    await open({ discordId, interactionId: interaction(), caseId: one._id, quantity: 1 });

    expect(emitted.find((x) => x.event === "caseOpened").payload.source).toBe("discord");
  });

  // a gateway resume replays whatever the bot missed while it was disconnected, so one
  // /open can arrive twice. this is the guard, and it is a claim rather than a check.
  it("charges once when the same interaction arrives twice", async () => {
    const user = await makeUser(5000);
    const discordId = oldEnough();
    await linkUser(user, discordId);
    const one = await makeCase(400);
    const id = interaction();

    const first = await open({ discordId, interactionId: id, caseId: one._id, quantity: 1 });
    const again = await open({ discordId, interactionId: id, caseId: one._id, quantity: 1 });

    expect(first.status).toBe(200);
    expect(again.status).toBe(409);
    expect(again.body.duplicate).toBe(true);

    const after = await User.findById(user._id).lean();
    expect(after.walletBalance).toBe(4600);
    expect(after.inventory).toHaveLength(1);
    expect(await Transaction.countDocuments({ userId: user._id })).toBe(1);
  });

  it("charges once when both arrive at the same moment", async () => {
    const user = await makeUser(5000);
    const discordId = oldEnough();
    await linkUser(user, discordId);
    const one = await makeCase(400);
    const id = interaction();

    const both = await Promise.all([
      open({ discordId, interactionId: id, caseId: one._id, quantity: 1 }),
      open({ discordId, interactionId: id, caseId: one._id, quantity: 1 }),
    ]);

    expect(both.filter((res) => res.status === 200)).toHaveLength(1);
    const after = await User.findById(user._id).lean();
    expect(after.inventory).toHaveLength(1);
  });

  // an opening that never happened must not burn the interaction, or somebody who tops up
  // and presses the button again is told they already opened it
  it("frees the interaction again when the opening was refused", async () => {
    const user = await makeUser(10);
    const discordId = oldEnough();
    await linkUser(user, discordId);
    const one = await makeCase(900);
    const id = interaction();

    const broke = await open({ discordId, interactionId: id, caseId: one._id, quantity: 1 });
    expect(broke.status).toBe(400);
    expect(await DiscordOpen.countDocuments({ interactionId: id })).toBe(0);

    await User.updateOne({ _id: user._id }, { $set: { walletBalance: 5000 } });
    expect((await open({ discordId, interactionId: id, caseId: one._id, quantity: 1 })).status).toBe(200);
  });

  // the bot spins a demo for somebody with no account and must not do that for a case
  // that does not exist, so the two 404s have to be told apart by something other than
  // their wording
  it("turns away a discord user with no account, and says that is why", async () => {
    const one = await makeCase(100);
    const res = await open({ discordId: oldEnough(), interactionId: interaction(), caseId: one._id, quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.notLinked).toBe(true);
  });

  it("does not call a missing case a missing account", async () => {
    const user = await makeUser();
    const discordId = oldEnough();
    await linkUser(user, discordId);
    const gone = new (require("mongoose").Types.ObjectId)();

    const res = await open({ discordId, interactionId: interaction(), caseId: gone, quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.notLinked).toBeUndefined();
  });

  it("keeps the dearest cases on the site", async () => {
    const user = await makeUser(10000000);
    const discordId = oldEnough();
    await linkUser(user, discordId);
    const dear = await makeCase(999999);

    const res = await open({ discordId, interactionId: interaction(), caseId: dear._id, quantity: 1 });
    expect(res.status).toBe(403);
    const after = await User.findById(user._id).lean();
    expect(after.inventory).toHaveLength(0);
  });

  it("holds the quantity between one and five", async () => {
    const user = await makeUser();
    const discordId = oldEnough();
    await linkUser(user, discordId);
    const one = await makeCase(10);
    for (const quantity of [0, 6, 2.5]) {
      expect((await open({ discordId, interactionId: interaction(), caseId: one._id, quantity })).status).toBe(400);
    }
  });

  it("needs the bot secret like everything else", async () => {
    const one = await makeCase(100);
    const res = await request(app).post("/discord/open").send({ discordId: oldEnough(), interactionId: interaction(), caseId: one._id, quantity: 1 });
    expect(res.status).toBe(403);
  });
});

describe("the spin for someone with no account", () => {
  it("draws a real item, hands over nothing and stores nothing", async () => {
    const one = await makeCase(100);
    const before = await Roll.countDocuments();

    const res = await bot(request(app).get(`/discord/preview/${one._id}`));

    expect(res.status).toBe(200);
    expect(res.body.kept).toBe(false);
    expect(res.body.item.name).toEqual(expect.any(String));
    expect(res.body.item.value).toEqual(expect.any(Number));
    expect(res.body.reel.length).toBeGreaterThan(0);
    expect(res.body.reel[0]).toMatchObject({ name: expect.any(String), rarity: expect.any(String) });
    // no nonce spent, no audit row, nothing to reconcile later
    expect(await Roll.countDocuments()).toBe(before);
  });

  it("draws from the case it was asked about", async () => {
    const one = await makeCase(100);
    const names = (await Item.find({ _id: { $in: one.items } }).lean()).map((item) => item.name);
    const res = await bot(request(app).get(`/discord/preview/${one._id}`));
    expect(names).toContain(res.body.item.name);
  });

  it("will not preview a case the bot could not open either", async () => {
    const dear = await makeCase(999999);
    expect((await bot(request(app).get(`/discord/preview/${dear._id}`))).status).toBe(403);
  });
});

describe("what autocomplete offers", () => {
  it("lists only the cases the bot is allowed to open", async () => {
    await makeCase(50);
    await makeCase(999999);

    const res = await bot(request(app).get("/discord/cases"));
    expect(res.status).toBe(200);
    expect(res.body.cases.length).toBeGreaterThan(0);
    expect(res.body.cases.every((one) => one.price <= res.body.maxPrice)).toBe(true);
  });

  it("narrows on what has been typed", async () => {
    const s = uniqueSuffix();
    await makeCase(50, `Lunatic ${s}`);
    await makeCase(60, `Festival ${s}`);

    const res = await bot(request(app).get(`/discord/cases?q=Lunatic ${s}`));
    expect(res.body.cases).toHaveLength(1);
    expect(res.body.cases[0].title).toContain("Lunatic");
  });

  // not one case is called "Touhou": they are Lunatic, Nuclear and The Special Package.
  // a player asks for the series, so the series has to be searchable.
  it("finds a series by name even though no case is called after it", async () => {
    const s = uniqueSuffix();
    const mine = await Case.create({
      title: `Lunatic ${s}`,
      image: "case.png",
      price: 60,
      category: `Touhou-${s}`,
      items: (await Item.create([{ name: `i-${s}`, image: "i.png", rarity: "1", baseValue: 10 }])).map((i) => i._id),
    });
    await recomputeCaseValues(mine._id);

    const res = await bot(request(app).get(`/discord/cases?q=Touhou-${s}`));
    expect(res.status).toBe(200);
    expect(res.body.cases.map((one) => String(one.id))).toContain(String(mine._id));
    // and the row carries the series, since the title does not
    expect(res.body.cases.find((one) => String(one.id) === String(mine._id)).category).toBe(`Touhou-${s}`);
  });

  // the box is free text, so a bracket is something a player typed, not a pattern
  it("treats a typed bracket as text", async () => {
    const s = uniqueSuffix();
    await makeCase(50, `Special (Package) ${s}`);
    const res = await bot(request(app).get(`/discord/cases?q=${encodeURIComponent(`Special (Package) ${s}`)}`));
    expect(res.status).toBe(200);
    expect(res.body.cases).toHaveLength(1);
  });

  it("leads with what this player opened last", async () => {
    const user = await makeUser(50000);
    const discordId = oldEnough();
    await linkUser(user, discordId);
    const cheap = await makeCase(20, `aaa-cheap-${uniqueSuffix()}`);
    const other = await makeCase(80, `zzz-other-${uniqueSuffix()}`);

    // the dearer one is opened, so price order alone would not put it first
    await open({ discordId, interactionId: interaction(), caseId: other._id, quantity: 1 });

    const res = await bot(request(app).get(`/discord/cases?discordId=${discordId}`));
    expect(String(res.body.cases[0].id)).toBe(String(other._id));
    expect(res.body.cases.map((one) => String(one.id))).toContain(String(cheap._id));
  });
});
