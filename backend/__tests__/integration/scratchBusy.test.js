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
const Roll = require("../../models/Roll");

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
const buy = (u) => request(app).post("/games/scratch").set("Authorization", `Bearer ${tokenFor(u)}`).send({ ticket: "nine", quantity: 5 });

test("a failed charge on a funded wallet says try again, and an empty one still says insufficient balance", async () => {
  mockFailCharge = true;
  const funded = await makeUser(1000);
  const busy = await buy(funded);
  expect(busy.status).toBe(503);
  expect(busy.body.message).not.toMatch(/insufficient/i);
  expect(await Roll.findOne({ userId: funded._id })).toBeNull();

  // enough for one ticket, not for the stack of five
  const broke = await makeUser(300);
  expect((await buy(broke)).status).toBe(400);
});
