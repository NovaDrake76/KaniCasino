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

const auth = (user) => ["Authorization", `Bearer ${tokenFor(user)}`];

const makeUser = () =>
  User.create({
    username: `user-${uniqueSuffix()}`,
    email: `${uniqueSuffix()}@example.com`,
    password: "x",
    walletBalance: 0,
  });

// the limiters skip themselves under NODE_ENV=test so the rest of the suite can run flat
// out. this file turns them back on, because a route that lost its limiter would other-
// wise fail silently: everything still passes, and only production notices.
describe("the per-user rate limits", () => {
  const realEnv = process.env.NODE_ENV;
  beforeAll(() => {
    process.env.NODE_ENV = "development";
  });
  afterAll(() => {
    process.env.NODE_ENV = realEnv;
  });

  it("caps marketplace buys per account, and answers 429 rather than erroring", async () => {
    const user = await makeUser();
    const bad = "0".repeat(24);

    let sawLimit = false;
    let lastBefore = null;
    for (let i = 0; i < 35; i++) {
      const res = await request(app).post(`/marketplace/buy/${bad}`).set(...auth(user));
      if (res.status === 429) {
        sawLimit = true;
        break;
      }
      lastBefore = res.status;
    }

    expect(sawLimit).toBe(true);
    // the requests before the cap were refused on their own merits, not by the limiter
    expect(lastBefore).toBeLessThan(500);
    expect(lastBefore).not.toBe(429);
  }, 30000);

  it("counts each account separately, so one busy player cannot lock anyone else out", async () => {
    const noisy = await makeUser();
    const quiet = await makeUser();
    const bad = "0".repeat(24);

    for (let i = 0; i < 35; i++) {
      await request(app).post(`/marketplace/buy/${bad}`).set(...auth(noisy));
    }
    const theirs = await request(app).post(`/marketplace/buy/${bad}`).set(...auth(noisy));
    const others = await request(app).post(`/marketplace/buy/${bad}`).set(...auth(quiet));

    expect(theirs.status).toBe(429);
    expect(others.status).not.toBe(429);
  }, 30000);
});
