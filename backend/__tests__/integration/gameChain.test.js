process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const GameSeedChain = require("../../models/GameSeedChain");
const { consumeNextSeed } = require("../../utils/gameChain");
const { sha256, linksTo } = require("../../utils/hashChain");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

test("seeds are handed out in order and form a verifiable chain", async () => {
  const first = await consumeNextSeed("crash");
  const second = await consumeNextSeed("crash");
  const third = await consumeNextSeed("crash");

  // one chain was created and all three came from it
  expect(await GameSeedChain.countDocuments({ game: "crash" })).toBe(1);
  expect(first.index).toBe(0);
  expect(second.index).toBe(1);
  expect(third.index).toBe(2);

  // the first links to the public terminal, each next links to the one before it
  expect(linksTo(first.seed, first.terminalHash)).toBe(true);
  expect(sha256(second.seed)).toBe(first.seed);
  expect(sha256(third.seed)).toBe(second.seed);
});

test("a client never sees an unconsumed seed", async () => {
  await consumeNextSeed("crash");
  // the seeds array is the secret; only the terminal hash is public
  const chain = await GameSeedChain.findOne({ game: "crash" });
  expect(chain.terminalHash).toHaveLength(64);
  expect(chain.seeds.length).toBeGreaterThan(1); // the rest are still unrevealed
});

test("an exhausted chain rotates to a fresh commitment", async () => {
  // shrink the active chain to one remaining seed, then consume past it
  const chain = await GameSeedChain.findOneAndUpdate(
    { game: "crash" },
    {},
    { upsert: false, new: true }
  ) || (await consumeNextSeed("crash"), await GameSeedChain.findOne({ game: "crash" }));
  await GameSeedChain.updateOne({ _id: chain._id }, { $set: { cursor: chain.seeds.length - 1 } });
  const oldTerminal = chain.terminalHash;

  const last = await consumeNextSeed("crash"); // consumes the final seed of the old chain
  const rotated = await consumeNextSeed("crash"); // must come from a new chain

  expect(last.terminalHash).toBe(oldTerminal);
  expect(rotated.terminalHash).not.toBe(oldTerminal);
  expect(rotated.index).toBe(0);
  expect(await GameSeedChain.countDocuments({ game: "crash", active: true })).toBe(1);
});
