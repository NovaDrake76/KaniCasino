process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeLadder(winnings) {
  const users = [];
  for (const w of winnings) {
    const s = uniqueSuffix();
    users.push(await User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", weeklyWinnings: w }));
  }
  return users;
}

const getRanking = (user) =>
  request(app).get("/users/ranking").set({ Authorization: `Bearer ${tokenFor(user)}` });

test("a mid-ladder user sees their rank and a seven-row window around them", async () => {
  const users = await makeLadder([100, 90, 80, 70, 60, 50, 40, 30, 20, 10]);
  const res = await getRanking(users[4]); // 60 -> rank 5

  expect(res.status).toBe(200);
  expect(res.body.ranking).toBe(5);
  expect(res.body.users).toHaveLength(7);
  expect(res.body.users[3].username).toBe(users[4].username);
  const winnings = res.body.users.map((u) => u.weeklyWinnings);
  expect(winnings).toEqual([90, 80, 70, 60, 50, 40, 30]);
});

test("the leader's window pads downward and stays seven rows", async () => {
  const users = await makeLadder([100, 90, 80, 70, 60, 50, 40, 30]);
  const res = await getRanking(users[0]);

  expect(res.body.ranking).toBe(1);
  expect(res.body.users).toHaveLength(7);
  expect(res.body.users[0].username).toBe(users[0].username);
  expect(res.body.users.map((u) => u.weeklyWinnings)).toEqual([100, 90, 80, 70, 60, 50, 40]);
});

test("the last place pads upward and stays seven rows", async () => {
  const users = await makeLadder([100, 90, 80, 70, 60, 50, 40, 30]);
  const res = await getRanking(users[7]);

  expect(res.body.ranking).toBe(8);
  expect(res.body.users).toHaveLength(7);
  expect(res.body.users[6].username).toBe(users[7].username);
  expect(res.body.users.map((u) => u.weeklyWinnings)).toEqual([90, 80, 70, 60, 50, 40, 30]);
});

test("tied players get distinct neighboring ranks", async () => {
  const users = await makeLadder([50, 50, 50]);
  const ranks = [];
  for (const u of users) {
    ranks.push((await getRanking(u)).body.ranking);
  }
  expect([...ranks].sort()).toEqual([1, 2, 3]);
});

test("a small ladder returns everyone without padding artifacts", async () => {
  const users = await makeLadder([20, 10]);
  const res = await getRanking(users[1]);
  expect(res.body.ranking).toBe(2);
  expect(res.body.users).toHaveLength(2);
  expect(res.body.users.map((u) => u.weeklyWinnings)).toEqual([20, 10]);
});
