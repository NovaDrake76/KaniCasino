process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Item = require("../../models/Item");
const FanBoard = require("../../models/FanBoard");
const CollectorBoard = require("../../models/CollectorBoard");
const fandom = require("../../utils/fandom");

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(over = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `u-${s}`,
    email: `u-${s}@e.com`,
    password: "x",
    walletBalance: 100,
    ...over,
  });
}

// a player pinned to a character, holding some copies of it
async function fan(name, copies, over = {}) {
  const item = await Item.create({ name, image: `${name}.png`, rarity: "4", baseValue: 100 });
  const inventory = Array.from({ length: copies }, () => ({
    _id: item._id,
    uniqueId: `uq-${uniqueSuffix()}`,
    name: item.name,
    image: item.image,
    rarity: item.rarity,
  }));
  return makeUser({
    inventory,
    fixedItem: { name: item.name, image: item.image, rarity: item.rarity, description: "" },
    fixedAt: new Date(),
    ...over,
  });
}

describe("the leaderboard", () => {
  it("leaves a disabled account out of the top players", async () => {
    await makeUser({ username: `clean-${uniqueSuffix()}`, weeklyWinnings: 100 });
    const banned = await makeUser({ username: `banned-${uniqueSuffix()}`, weeklyWinnings: 999999, disabled: true });

    const res = await request(app).get("/users/topPlayers");
    expect(res.status).toBe(200);
    expect(res.body.map((u) => u.username)).not.toContain(banned.username);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("does not count a disabled account in somebody's rank", async () => {
    // three accounts above the viewer, one of them disabled
    await makeUser({ weeklyWinnings: 300 });
    await makeUser({ weeklyWinnings: 200, disabled: true });
    await makeUser({ weeklyWinnings: 150 });
    const me = await makeUser({ weeklyWinnings: 10 });

    const res = await request(app)
      .get("/users/ranking")
      .set("Authorization", `Bearer ${tokenFor(me)}`);

    // two visible players are ahead, so third place, not fourth
    expect(res.body.ranking).toBe(3);
    expect(res.body.users.every((u) => !u.disabled)).toBe(true);
  });
});

describe("the public profile", () => {
  it("reads as no such player", async () => {
    const banned = await makeUser({ disabled: true });
    const res = await request(app).get(`/users/${banned._id}`);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("still works for everybody else", async () => {
    const user = await makeUser();
    const res = await request(app).get(`/users/${user._id}`);
    expect(res.body.username).toBe(user.username);
  });

  it("hides their inventory too", async () => {
    const banned = await makeUser({ disabled: true });
    const res = await request(app).get(`/users/inventory/${banned._id}`);
    expect(res.status).toBe(404);
  });
});

// the sweep rebuilds every board from every account on a ten minute cron, so without this
// a disabled name is back on top fan within the hour however many times it is cleared
describe("the fan boards", () => {
  it("drops a disabled account on the next sweep", async () => {
    const keeper = await fan("Reimu", 2);
    const banned = await fan("Reimu", 50, { disabled: true });

    await fandom.rebuild();

    const board = await FanBoard.findOne({ name: "Reimu" });
    expect(board).toBeTruthy();
    const names = board.ranks.map((r) => r.username);
    expect(names).not.toContain(banned.username);
    expect(names).toContain(keeper.username);
    // and the disabled account does not take the board with fifty copies
    expect(board.top.username).toBe(keeper.username);
    expect(board.fanCount).toBe(1);
  });

  it("keeps them off the collector board", async () => {
    await fan("Marisa", 3);
    const banned = await fan("Yukari", 40, { disabled: true });

    await fandom.rebuild();

    const board = await CollectorBoard.findOne({ key: "collection" });
    expect(board.ranks.map((r) => r.username)).not.toContain(banned.username);
  });

  // fanRank is what puts the top fan badge on a player site-wide, so a disabled account
  // must never come out of a sweep holding one. mongoose materialises the nested path as
  // an empty object rather than leaving it undefined, so the check is on the contents.
  it("does not hand them a fanRank to wear", async () => {
    const keeper = await fan("Sakuya", 2);
    const banned = await fan("Sakuya", 30, { disabled: true });
    await fandom.rebuild();

    const after = await User.findById(banned._id);
    expect(after.fanRank && after.fanRank.name).toBeFalsy();
    // and the sweep did run, so this is not just an empty rebuild
    expect((await User.findById(keeper._id)).fanRank.name).toBe("Sakuya");
  });

  // pinning triggers a targeted rebuild of just that character's board
  it("leaves them out of a single-character refresh too", async () => {
    const keeper = await fan("Cirno", 1);
    const banned = await fan("Cirno", 60, { disabled: true });

    await fandom.refreshCharacters(["Cirno"]);

    const board = await FanBoard.findOne({ name: "Cirno" });
    expect(board.ranks.map((r) => r.username)).toEqual([keeper.username]);
  });
});

describe("friends", () => {
  it("drops a disabled friend from the list", async () => {
    const banned = await makeUser({ disabled: true });
    const keeper = await makeUser();
    const me = await makeUser({ friends: [banned._id, keeper._id] });

    const res = await request(app).get("/friends/me").set("Authorization", `Bearer ${tokenFor(me)}`);
    expect(res.status).toBe(200);
    // populate yields null where the match fails; those must not reach the client
    expect(res.body.friends).toHaveLength(1);
    expect(res.body.friends[0].username).toBe(keeper.username);
  });

  it("drops a disabled friend request", async () => {
    const banned = await makeUser({ disabled: true });
    const me = await makeUser({ friendRequests: [banned._id] });

    const res = await request(app).get("/friends/me").set("Authorization", `Bearer ${tokenFor(me)}`);
    expect(res.body.requests).toEqual([]);
  });

  it("hides a disabled account's own friends list", async () => {
    const banned = await makeUser({ disabled: true });
    const res = await request(app).get(`/friends/list/${banned._id}`);
    expect(res.status).toBe(404);
  });
});

// what a ban must never do: rewrite what already happened
describe("what stays", () => {
  it("keeps the account and everything on it", async () => {
    const banned = await makeUser({ walletBalance: 2536, disabled: true });
    const after = await User.findById(banned._id);
    expect(after).toBeTruthy();
    expect(after.walletBalance).toBe(2536);
  });
});
