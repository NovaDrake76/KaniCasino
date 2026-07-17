process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp } = require("./helpers");
const Round = require("../../models/Round");
const { generateChain, sha256 } = require("../../utils/hashChain");
const { crashPointFromSeed } = require("../../utils/crashMath");

let app;
beforeAll(async () => { await setupDb(); app = makeApp(); });
afterEach(clearDb);
afterAll(teardownDb);

// a settled crash round as the game would have written it
async function settledRound() {
  const { seeds, terminalHash } = generateChain(3);
  const seed = seeds[0];
  return Round.create({
    game: "crash",
    status: "settled",
    serverSeed: seed,
    serverSeedHash: sha256(seed),
    chainIndex: 0,
    outcome: { crashPoint: crashPointFromSeed(seed) },
    // terminalHash is not needed by the endpoint, but the chain produced this seed
    meta: { terminalHash },
  });
}

test("a settled round reveals the seed and verifies", async () => {
  const round = await settledRound();
  const res = await request(app).get(`/fair/crash/${round._id}`);

  expect(res.status).toBe(200);
  expect(res.body.revealed).toBe(true);
  expect(res.body.serverSeed).toBe(round.serverSeed);
  expect(res.body.commitmentValid).toBe(true);
  expect(res.body.outcomeValid).toBe(true);
  expect(res.body.recomputedCrashPoint).toBe(round.outcome.crashPoint);
});

test("a running round shows the commitment but never the seed", async () => {
  const round = await settledRound();
  await Round.updateOne({ _id: round._id }, { $set: { status: "running" } });

  const res = await request(app).get(`/fair/crash/${round._id}`);
  expect(res.status).toBe(200);
  expect(res.body.revealed).toBe(false);
  expect(res.body.serverSeedHash).toBe(round.serverSeedHash);
  expect(res.body.serverSeed).toBeUndefined();
  expect(res.body.crashPoint).toBeUndefined();
});

test("an unknown round is a 404", async () => {
  const res = await request(app).get("/fair/crash/000000000000000000000000");
  expect(res.status).toBe(404);
});
