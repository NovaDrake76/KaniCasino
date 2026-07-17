process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp } = require("./helpers");
const Round = require("../../models/Round");

let app;
beforeAll(async () => { await setupDb(); app = makeApp(); });
afterEach(clearDb);
afterAll(teardownDb);

const settledFlip = (result, at) =>
  Round.create({
    game: "coinflip",
    status: "settled",
    outcome: { result, winningSide: result === 0 ? "heads" : "tails" },
    createdAt: at,
  });

test("returns recent settled coin flips, newest first", async () => {
  await settledFlip(0, new Date("2026-01-01"));
  await settledFlip(1, new Date("2026-01-02"));
  await settledFlip(0, new Date("2026-01-03"));

  const res = await request(app).get("/games/coinflip/history");

  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(3);
  expect(res.body[0].winningSide).toBe("heads"); // the 01-03 flip, newest
  expect(res.body.map((r) => r.result)).toEqual([0, 1, 0]);
});

test("only settled coin flips are returned, and the limit is honoured", async () => {
  for (let i = 0; i < 20; i++) await settledFlip(i % 2, new Date(2026, 0, i + 1));
  await Round.create({ game: "coinflip", status: "betting" }); // in-flight, excluded
  await Round.create({ game: "crash", status: "settled", outcome: { crashPoint: 2 } }); // wrong game

  const res = await request(app).get("/games/coinflip/history?limit=5");

  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(5);
  for (const r of res.body) expect([0, 1]).toContain(r.result);
});

test("no history is an empty list, not an error", async () => {
  const res = await request(app).get("/games/coinflip/history");
  expect(res.status).toBe(200);
  expect(res.body).toEqual([]);
});
