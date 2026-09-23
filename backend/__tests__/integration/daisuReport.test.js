process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const MissionState = require("../../models/MissionState");
const UsageEvent = require("../../models/UsageEvent");
const { TX } = require("../../utils/economy");
const { report } = require("../../scripts/daisuReport");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `Mio ${s}`, slug: `mio-${s}`, email: `m${s}@k.co`, walletBalance: 100, betaFlags: ["daisu"], ...fields });
};
const at = (secondsAgo) => new Date(Date.now() - secondsAgo * 1000);
const event = (user, name, params, secondsAgo, sid = "tab") => ({ userId: user._id, name, params, path: "/", sid, at: at(secondsAgo) });

describe("the daisu report", () => {
  it("reads the card, the room, the shop, the locks and the tour back out of the record", async () => {
    const aya = await makeUser({ onboarding: { status: "done", step: "done" } });
    const ren = await makeUser({ onboarding: { status: "skipped", step: "pot" } });
    const kai = await makeUser();
    await Transaction.create([
      { userId: aya._id, type: TX.DICE_BET, direction: "debit", amount: 10 },
      { userId: ren._id, type: TX.BONUS, direction: "credit", amount: 50, meta: { fill: 1 } },
      { userId: aya._id, type: TX.MISSION_REWARD, direction: "credit", amount: 100, meta: { missionKey: "r1-level", roadmapChapter: 1 } },
      { userId: aya._id, type: TX.SHOP_PURCHASE, direction: "debit", amount: 500, meta: { unlock: "spyglass" } },
    ]);
    await MissionState.create({ userId: aya._id, roadmap: { chapter: 1, openedAt: at(3600), claimed: ["r1-level"] } });
    await UsageEvent.insertMany([
      event(aya, "daisu_open", { via: "bubble", showing: "gift", attention: true }, 300),
      event(aya, "daisu_room", { via: "card_missions", from: "popup" }, 290),
      event(aya, "daisu_close", { via: "close", from: "room", secs: 40 }, 250),
      event(ren, "daisu_open", { via: "bonus_button" }, 200, "other"),
      event(ren, "daisu_close", { via: "close", from: "popup", secs: 1 }, 199, "other"),
      event(aya, "locked_view", { unlock: "spyglass" }, 180),
      event(ren, "locked_view", { unlock: "spyglass" }, 170, "other"),
      event(aya, "daisu_room", { via: "shop_link", from: "bubble", item: "spyglass" }, 160),
      event(aya, "shop_item", { item: "spyglass", via: "shop_link", state: "open" }, 159),
      event(ren, "shop_item", { item: "diceCharm", via: "shelf", state: "open" }, 150, "other"),
      event(ren, "tour_step", { step: "pot" }, 120, "other"),
      event(ren, "tour_step", { step: "skipped" }, 60, "other"),
      // a player who only looked, and a row stored before params were kept on every row
      event(kai, "daisu_open", { via: "bubble", showing: "jar", attention: false }, 100, "third"),
    ]);
    await UsageEvent.collection.insertOne({ userId: kai._id, name: "locked_view", sid: "third", at: at(90) });

    const text = await report(7);

    expect(text).toMatch(/3 players were active: 2 played, and 3 left usage events/);
    expect(text).toMatch(/opened her card: 3 players \(100%\), 3 times\. By: bubble 2, bonus_button 1/);
    expect(text).toMatch(/the bubble was showing: gift 1, jar 1; its dot was on for 50%/);
    expect(text).toMatch(/opened her room: 1 players \(33%\), 2 times/);
    expect(text).toMatch(/closed within 3 seconds: 1 of 2/);
    expect(text).toMatch(/claimed: 1 by 1 players\. r1-level 1/);
    expect(text).toMatch(/could buy, looked, did not: diceCharm 1/);
    expect(text).toMatch(/spyglass: seen by 2 players, 1 went to her shop from it, 1 bought it/);
    expect(text).toMatch(/players reaching each step: pot 1,.* skipped 1/);
    expect(text).toMatch(/median time on each step: pot 60s/);
    expect(text).toMatch(/where the players' tours stand: .*skipped@pot 1/);
  });
});
