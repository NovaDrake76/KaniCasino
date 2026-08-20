process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const MissionState = require("../../models/MissionState");
const Notification = require("../../models/Notification");
const badges = require("../../utils/badges");

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

const topFan = { name: "Yuuma", image: "y.png", rarity: "5", count: 12, rank: 1, fans: 4 };

describe("holding badges", () => {
  it("derives top fan from the fan sweep, not from storage", async () => {
    const holder = await makeUser({ fanRank: topFan });
    const chaser = await makeUser({ fanRank: { ...topFan, rank: 2, count: 3 } });

    expect(badges.heldBadges(holder).map((b) => b.key)).toEqual(["topFan"]);
    expect(badges.heldBadges(chaser)).toHaveLength(0);
    expect(badges.heldBadges(holder)[0].fandom.name).toBe("Yuuma");
  });

  it("wears nothing until a badge is picked", async () => {
    const user = await makeUser({ fanRank: topFan });
    expect(badges.wornBadge(user)).toBeNull();

    user.selectedBadge = "topFan";
    expect(badges.wornBadge(user).key).toBe("topFan");
  });

  it("wears nothing when the chosen badge is no longer held", async () => {
    const user = await makeUser({ selectedBadge: "topFan", fanRank: { ...topFan, rank: 3 } });
    expect(badges.wornBadge(user)).toBeNull();
  });
});

describe("granting", () => {
  it("grants and revokes a contributor badge, once", async () => {
    const user = await makeUser();
    expect((await badges.grant(user._id, "contributor", "translation")).changed).toBe(true);
    expect((await badges.grant(user._id, "contributor")).changed).toBe(false);

    let after = await User.findById(user._id).lean();
    expect(badges.heldBadges(after).map((b) => b.key)).toEqual(["contributor"]);
    expect(after.badges[0].note).toBe("translation");

    await badges.revoke(user._id, "contributor");
    after = await User.findById(user._id).lean();
    expect(badges.heldBadges(after)).toHaveLength(0);
  });

  it("refuses to grant a badge that is earned", async () => {
    const user = await makeUser();
    expect((await badges.grant(user._id, "connected")).ok).toBe(false);
    expect((await badges.grant(user._id, "topFan")).ok).toBe(false);
  });

  it("clears a worn badge when it is revoked", async () => {
    const user = await makeUser();
    await badges.grant(user._id, "contributor");
    await User.updateOne({ _id: user._id }, { $set: { selectedBadge: "contributor" } });

    await badges.revoke(user._id, "contributor");
    const after = await User.findById(user._id).lean();
    expect(after.selectedBadge).toBeUndefined();
  });

  it("gates the admin route on the badge being grantable", async () => {
    const admin = await makeUser({ isAdmin: true });
    const target = await makeUser();
    const auth = `Bearer ${tokenFor(admin)}`;

    const earned = await request(app)
      .put(`/admin/users/${target._id}/badge`)
      .set("Authorization", auth)
      .send({ key: "connected" });
    expect(earned.status).toBe(400);

    const ok = await request(app)
      .put(`/admin/users/${target._id}/badge`)
      .set("Authorization", auth)
      .send({ key: "contributor", note: "art" });
    expect(ok.status).toBe(200);
    expect(ok.body.badges.map((b) => b.key)).toEqual(["contributor"]);
  });

  it("refuses a grant from a player who is not an admin", async () => {
    const player = await makeUser();
    const target = await makeUser();
    const res = await request(app)
      .put(`/admin/users/${target._id}/badge`)
      .set("Authorization", `Bearer ${tokenFor(player)}`)
      .send({ key: "contributor" });
    expect(res.status).toBe(403);
  });
});

describe("the connected badge", () => {
  it("lands only once every social mission is claimed", async () => {
    const user = await makeUser();
    await MissionState.create({ userId: user._id, claimed: ["join-discord"] });

    expect(await badges.awardConnected(user._id)).toBe(false);

    await MissionState.updateOne({ userId: user._id }, { $addToSet: { claimed: "follow-x" } });
    expect(await badges.awardConnected(user._id)).toBe(true);
    // and never twice
    expect(await badges.awardConnected(user._id)).toBe(false);

    const after = await User.findById(user._id).lean();
    expect(badges.heldBadges(after).map((b) => b.key)).toEqual(["connected"]);
  });
});

describe("the backfill sweep", () => {
  it("awards everyone who finished the social missions before the badge existed", async () => {
    const done = await makeUser();
    const halfway = await makeUser();
    const already = await makeUser({ badges: [{ key: "connected", awardedAt: new Date() }] });
    await MissionState.create({ userId: done._id, claimed: ["join-discord", "follow-x"] });
    await MissionState.create({ userId: halfway._id, claimed: ["join-discord"] });
    await MissionState.create({ userId: already._id, claimed: ["join-discord", "follow-x"] });

    expect(await badges.sweepConnected()).toBe(1);

    expect(badges.heldBadges(await User.findById(done._id).lean()).map((b) => b.key)).toEqual(["connected"]);
    expect(badges.heldBadges(await User.findById(halfway._id).lean())).toHaveLength(0);
    // a second pass finds nothing left to do
    expect(await badges.sweepConnected()).toBe(0);
  });

  it("tells the player, once", async () => {
    const user = await makeUser();
    await MissionState.create({ userId: user._id, claimed: ["join-discord", "follow-x"] });

    await badges.sweepConnected();
    await badges.sweepConnected();

    const notes = await Notification.find({ receiverId: user._id }).lean();
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("New badge");
    expect(notes[0].content).toContain("Connected");
  });

  it("emits to the player when a socket is passed", async () => {
    const user = await makeUser();
    await MissionState.create({ userId: user._id, claimed: ["join-discord", "follow-x"] });
    const rooms = [];
    const io = { to: (room) => ({ emit: (event, payload) => rooms.push({ room, event, payload }) }) };

    await badges.sweepConnected(io);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ room: String(user._id), event: "newNotification" });
  });

  it("tells the player about a granted badge too", async () => {
    const user = await makeUser();
    await badges.grant(user._id, "contributor", "translation");
    const notes = await Notification.find({ receiverId: user._id }).lean();
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toContain("Contributor");

    // granting again changes nothing, so it says nothing
    await badges.grant(user._id, "contributor");
    expect(await Notification.countDocuments({ receiverId: user._id })).toBe(1);
  });
});

describe("choosing a badge", () => {
  it("lets a player wear one they hold and clear it again", async () => {
    const user = await makeUser({ fanRank: topFan });
    const auth = `Bearer ${tokenFor(user)}`;

    const worn = await request(app).put("/users/badge").set("Authorization", auth).send({ badge: "topFan" });
    expect(worn.status).toBe(200);
    expect(worn.body.badge.key).toBe("topFan");

    const cleared = await request(app).put("/users/badge").set("Authorization", auth).send({ badge: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.badge).toBeNull();
  });

  it("refuses a badge the player does not hold", async () => {
    const user = await makeUser();
    const res = await request(app)
      .put("/users/badge")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ badge: "contributor" });
    expect(res.status).toBe(400);
  });

  it("serves the worn badge on the public profile and the leaderboard", async () => {
    const user = await makeUser({ fanRank: topFan, selectedBadge: "topFan", weeklyWinnings: 10 });

    const profile = await request(app).get(`/users/${user._id}`);
    expect(profile.body.badge.key).toBe("topFan");
    expect(profile.body.badge.fandom.count).toBe(12);
    expect(profile.body.badges).toHaveLength(1);

    const top = await request(app).get("/users/topPlayers");
    expect(top.body[0].badge.key).toBe("topFan");
  });
});
