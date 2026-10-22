process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// a charge that loses its write comes back null like an empty wallet does; the player must be told which
let mockFailCharge = false;
jest.mock("../../utils/economy", () => {
  const actual = jest.requireActual("../../utils/economy");
  return { ...actual, chargeUser: (...args) => (mockFailCharge ? Promise.resolve(null) : actual.chargeUser(...args)) };
});

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(async () => {
  mockFailCharge = false;
  await clearDb();
});
afterAll(teardownDb);

const makeUser = (walletBalance) => {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance });
};
const roll = (u) => request(app).post("/games/dice").set("Authorization", `Bearer ${tokenFor(u)}`).send({ betAmount: 100, target: 5000, direction: "over" });

test("a failed charge on a funded wallet says try again, and an empty one still says insufficient balance", async () => {
  mockFailCharge = true;
  const funded = await makeUser(1000);
  const busy = await roll(funded);
  expect(busy.status).toBe(503);
  expect(busy.body.message).not.toMatch(/insufficient/i);

  const broke = await makeUser(5);
  expect((await roll(broke)).status).toBe(400);
});
