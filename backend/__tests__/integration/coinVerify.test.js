process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp } = require("./helpers");
const Round = require("../../models/Round");
const { generateChain, sha256 } = require("../../utils/hashChain");
const { coinResultFromSeed } = require("../../utils/coinMath");

let app;
beforeAll(async () => { await setupDb(); app = makeApp(); });
afterEach(clearDb);
afterAll(teardownDb);

async function settledRound() {
  const { seeds } = generateChain(3);
  const seed = seeds[0];
  const result = coinResultFromSeed(seed);
  return Round.create({
    game: "coinflip",
    status: "settled",
    serverSeed: seed,
    serverSeedHash: sha256(seed),
    chainIndex: 0,
    outcome: { result, winningSide: result === 0 ? "heads" : "tails" },
  });
}

test("a settled coin flip reveals the seed and verifies", async () => {
  const round = await settledRound();
  const res = await request(app).get(`/fair/coinflip/${round._id}`);

  expect(res.status).toBe(200);
  expect(res.body.revealed).toBe(true);
  expect(res.body.serverSeed).toBe(round.serverSeed);
  expect(res.body.commitmentValid).toBe(true);
  expect(res.body.outcomeValid).toBe(true);
  expect(res.body.recomputedResult).toBe(round.outcome.result);
});

test("a running coin flip shows the commitment but never the seed", async () => {
  const round = await settledRound();
  await Round.updateOne({ _id: round._id }, { $set: { status: "running" } });

  const res = await request(app).get(`/fair/coinflip/${round._id}`);
  expect(res.status).toBe(200);
  expect(res.body.revealed).toBe(false);
  expect(res.body.serverSeedHash).toBe(round.serverSeedHash);
  expect(res.body.serverSeed).toBeUndefined();
  expect(res.body.result).toBeUndefined();
});

test("a crash round is not served by the coin flip route", async () => {
  const round = await Round.create({ game: "crash", status: "settled", serverSeed: "x", serverSeedHash: "y" });
  const res = await request(app).get(`/fair/coinflip/${round._id}`);
  expect(res.status).toBe(404);
});
