process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { setupDb, clearDb, teardownDb } = require("./db");
const { tokenFor, uniqueSuffix } = require("./helpers");
// upgrade.js destructures rollFloat at load, so the module has to be replaced before it
// is required rather than spied on afterwards
jest.mock("../../utils/provablyFair", () => ({
  ...jest.requireActual("../../utils/provablyFair"),
  rollFloat: jest.fn(),
}));
const gamesRoutes = require("../../routes/gamesRoutes");
const { rollFloat } = require("../../utils/provablyFair");
const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");

// the feed only ever heard about case openings, so an upgrade that produced an item put
// nothing in it. these pin the event down: it fires on a win, stays quiet on a loss, and
// says where it came from, because the card shows the parent case either way.
let emitted;
const io = { emit: (event, payload) => emitted.push({ event, payload }), to: () => ({ emit: () => {} }) };

const app = express();
app.use(express.json());
app.use("/games", gamesRoutes(io));

beforeAll(setupDb);
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDb();
});
afterAll(teardownDb);

async function scenario() {
  emitted = [];
  const caseDoc = await Case.create({
    title: `c-${uniqueSuffix()}`, image: "case.png", price: 100,
  });
  const target = await Item.create({
    name: `t-${uniqueSuffix()}`, image: "t.png", rarity: "3", case: caseDoc._id, baseValue: 100,
  });
  const low = await Item.create({
    name: `l-${uniqueSuffix()}`, image: "l.png", rarity: "1", case: caseDoc._id, baseValue: 40,
  });
  const user = await User.create({
    username: `u-${uniqueSuffix()}`,
    email: `u-${uniqueSuffix()}@e.com`,
    password: "x",
    profilePicture: "me.png",
    inventory: ["a", "b", "c"].map((uniqueId) => ({
      _id: low._id, name: low.name, image: low.image, rarity: "1", case: caseDoc._id, uniqueId,
    })),
  });
  return { user, target, caseDoc };
}

const upgrade = (user, target) =>
  request(app)
    .post("/games/upgrade")
    .set("Authorization", `Bearer ${tokenFor(user)}`)
    .send({ selectedItemIds: ["a", "b", "c"], targetItemId: target._id.toString() });

test("a won upgrade reaches the live drop feed", async () => {
  const { user, target, caseDoc } = await scenario();
  rollFloat.mockReturnValue(0); // always under the rate

  const res = await upgrade(user, target);
  expect(res.body.success).toBe(true);

  const drop = emitted.find((e) => e.event === "caseOpened");
  expect(drop).toBeDefined();
  expect(drop.payload.winningItems).toHaveLength(1);
  expect(String(drop.payload.winningItems[0]._id)).toBe(String(target._id));
  expect(drop.payload.user.name).toBe(user.username);
  // the flip side of the card shows the parent case, so it has to be the real one
  expect(drop.payload.caseImage).toBe(caseDoc.image);
  // and without this the drop reads as having come out of that case
  expect(drop.payload.source).toBe("upgrade");
});

test("a lost upgrade puts nothing in the feed", async () => {
  const { user, target } = await scenario();
  rollFloat.mockReturnValue(0.999); // never under the rate

  const res = await upgrade(user, target);
  expect(res.body.success).toBe(false);
  expect(emitted.filter((e) => e.event === "caseOpened")).toHaveLength(0);
});
