process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, teardownDb } = require("./db");
const Roll = require("../../models/Roll");

beforeAll(setupDb);
afterAll(teardownDb);

// the rolls collection was 36% of a 512 MB budget and only ever grew. this is the one
// thing keeping it bounded, and losing it would not fail anything else.
test("rolls expire after three days", async () => {
  await Roll.init(); // build the indexes mongoose declares
  const indexes = await Roll.collection.indexes();
  const ttl = indexes.find((i) => i.expireAfterSeconds !== undefined);

  expect(ttl).toBeDefined();
  expect(ttl.key).toEqual({ createdAt: 1 });
  // three days, down from thirty: 229K rolls past the old window were a third of the free
  // tier's whole budget, and the fair page looks one up by id rather than by age
  expect(ttl.expireAfterSeconds).toBe(3 * 24 * 60 * 60);
});

test("the lookups the fair page uses still have an index to stand on", async () => {
  await Roll.init();
  const names = (await Roll.collection.indexes()).map((i) => JSON.stringify(i.key));
  expect(names).toContain(JSON.stringify({ rollId: 1 }));
  expect(names).toContain(JSON.stringify({ userId: 1, createdAt: -1 }));
});
