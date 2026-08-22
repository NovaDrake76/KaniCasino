process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const express = require("express");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Prediction = require("../../models/Prediction");
const { trade } = require("../../utils/predictions");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

async function makeUser(overrides = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `p-${s}`,
    email: `p-${s}@example.com`,
    password: "x",
    walletBalance: 50000,
    ...overrides,
  });
}

async function makeMarket(overrides = {}) {
  const s = uniqueSuffix();
  return Prediction.create({
    slug: `m-${s}`,
    title: "Does she win",
    outcomes: Prediction.openBook(["Yes", "No"]),
    ...overrides,
  });
}

const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);

describe("the board", () => {
  it("lists markets to a guest", async () => {
    await makeMarket({ category: "Waifu" });
    const res = await request(app).get("/predictions");
    expect(res.status).toBe(200);
    expect(res.body.predictions).toHaveLength(1);
    expect(res.body.categories).toContain("Waifu");
    // a guest is shown the prices, and nothing about anybody's position
    expect(res.body.predictions[0].outcomes[0].shares).toBe(0);
  });

  it("filters by status, category and title", async () => {
    await makeMarket({ title: "Kanna sweeps", category: "Waifu" });
    await makeMarket({ title: "Holo sweeps", category: "Waifu", status: "closed" });
    await makeMarket({ title: "Rain tomorrow", category: "Site" });

    expect((await request(app).get("/predictions?status=open")).body.predictions).toHaveLength(2);
    expect((await request(app).get("/predictions?category=Waifu")).body.predictions).toHaveLength(2);
    expect((await request(app).get("/predictions?q=sweeps")).body.predictions).toHaveLength(2);
    expect((await request(app).get("/predictions?category=All")).body.predictions).toHaveLength(3);
  });

  it("tells a logged in player what they already hold", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 40 });

    const res = await auth(request(app).get("/predictions"), user);
    const outcome = res.body.predictions[0].outcomes[0];
    expect(outcome.shares).toBe(40);
    expect(outcome.avgPriceBps).toBeGreaterThan(0);
  });

  it("degrades a dead token to a guest view instead of a 401", async () => {
    await makeMarket();
    const res = await request(app).get("/predictions").set("Authorization", "Bearer not-a-token");
    expect(res.status).toBe(200);
    expect(res.body.predictions).toHaveLength(1);
  });
});

describe("one market", () => {
  it("reads by slug and 404s on one that does not exist", async () => {
    const market = await makeMarket();
    expect((await request(app).get(`/predictions/${market.slug}`)).body.title).toBe("Does she win");
    expect((await request(app).get("/predictions/nope")).status).toBe(404);
  });

  it("does not fall into the slug route on the way to a player's positions", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 12 });

    const res = await auth(request(app).get("/predictions/me/positions"), user);
    expect(res.status).toBe(200);
    expect(res.body.positions).toHaveLength(1);
    expect(res.body.positions[0].outcomeLabel).toBe("Yes");
    expect(res.body.positions[0].market.slug).toBe(market.slug);
    expect(res.body.positions[0].value).toBeGreaterThan(0);
  });

  it("draws a line per outcome, starting where the market opened", async () => {
    const user = await makeUser();
    const market = await makeMarket({ outcomes: Prediction.openBook(["A", "B", "C"]) });
    await trade({ userId: user._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 50 });

    const res = await request(app).get(`/predictions/${market.slug}/history`);
    expect(res.body.series).toHaveLength(3);
    for (const line of res.body.series) expect(line.points.length).toBeGreaterThanOrEqual(2);
    expect(res.body.series[0].points[0].priceBps).toBeGreaterThan(0);
  });

  it("gives an untraded market a flat line rather than an empty one", async () => {
    const market = await makeMarket();
    const res = await request(app).get(`/predictions/${market.slug}/history`);
    expect(res.body.series[0].points).toHaveLength(1);
    expect(res.body.series[0].points[0].priceBps).toBe(5200);
  });

  it("shows who has been trading, and hides the banned", async () => {
    const seen = await makeUser();
    const banned = await makeUser({ disabled: true });
    const market = await makeMarket();
    await trade({ userId: seen._id, predictionId: market._id, outcomeKey: "o1", action: "buy", shares: 10 });
    await trade({ userId: banned._id, predictionId: market._id, outcomeKey: "o2", action: "buy", shares: 10 });

    const res = await request(app).get(`/predictions/${market.slug}/trades`);
    expect(res.body.trades).toHaveLength(1);
    expect(res.body.trades[0].user.username).toBe(seen.username);
    expect(res.body.trades[0].outcomeLabel).toBe("Yes");
  });
});

describe("quoting and trading over http", () => {
  it("quotes without charging anything", async () => {
    const user = await makeUser();
    const market = await makeMarket();

    const res = await auth(request(app).post(`/predictions/${market.slug}/quote`), user)
      .send({ outcome: "o1", action: "buy", shares: 100 });
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(57);
    expect(res.body.avgPriceBps).toBe(5700);
    expect(res.body.held).toBe(0);
    expect((await User.findById(user._id)).walletBalance).toBe(50000);
  });

  it("charges exactly what it quoted", async () => {
    const user = await makeUser();
    const market = await makeMarket();

    const quoted = await auth(request(app).post(`/predictions/${market.slug}/quote`), user)
      .send({ outcome: "o1", action: "buy", shares: 137 });
    const filled = await auth(request(app).post(`/predictions/${market.slug}/trade`), user)
      .send({ outcome: "o1", action: "buy", shares: 137 });

    expect(filled.status).toBe(200);
    expect(filled.body.spent).toBe(quoted.body.amount);
    expect(filled.body.walletBalance).toBe(50000 - quoted.body.amount);
    expect(filled.body.prediction.outcomes[0].shares).toBe(137);
  });

  it("turns a bad trade into a message, not a 500", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    const bad = [
      { outcome: "o9", action: "buy", shares: 1 },
      { outcome: "o1", action: "hedge", shares: 1 },
      { outcome: "o1", action: "buy", shares: 0 },
      { outcome: "o1", action: "sell", shares: 5 },
    ];
    for (const body of bad) {
      const res = await auth(request(app).post(`/predictions/${market.slug}/trade`), user).send(body);
      expect(res.status).toBe(400);
      expect(res.body.message).toBeTruthy();
    }
  });

  it("will not take a trade from a guest", async () => {
    const market = await makeMarket();
    const res = await request(app).post(`/predictions/${market.slug}/trade`).send({ outcome: "o1", action: "buy", shares: 1 });
    expect(res.status).toBe(401);
  });
});

// a socket stub that keeps what it was told, so the live behaviour can be asserted rather
// than assumed: the navbar balance and every other viewer's prices both ride on these
function capturingApp() {
  const sent = { rooms: [], broadcast: [] };
  const io = {
    emit: (event, payload) => sent.broadcast.push({ event, payload }),
    to: (room) => ({ emit: (event, payload) => sent.rooms.push({ room, event, payload }) }),
  };
  const app = express();
  app.use(express.json());
  app.use("/predictions", require("../../routes/predictionRoutes")(io));
  return { app, sent };
}

describe("what a fill tells everyone else", () => {
  it("pushes the new balance to the trader, because the navbar reads it from there", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    const { app: live, sent } = capturingApp();

    const res = await auth(request(live).post(`/predictions/${market.slug}/trade`), user)
      .send({ outcome: "o1", action: "buy", shares: 100 });
    expect(res.status).toBe(200);

    const balance = sent.rooms.find((m) => m.event === "userDataUpdated");
    expect(balance.room).toBe(String(user._id));
    expect(balance.payload.walletBalance).toBe(50000 - res.body.spent);
    expect(balance.payload.level).toBeDefined();
  });

  it("broadcasts the prices, the running volume and the fill itself", async () => {
    const user = await makeUser();
    const market = await makeMarket();
    const { app: live, sent } = capturingApp();

    await auth(request(live).post(`/predictions/${market.slug}/trade`), user)
      .send({ outcome: "o1", action: "buy", shares: 100 });

    const update = sent.broadcast.find((m) => m.event === "predictionUpdated");
    expect(update.payload.slug).toBe(market.slug);
    expect(update.payload.outcomes).toHaveLength(2);
    expect(update.payload.outcomes[0].priceBps).toBe(6200);
    expect(update.payload.volume).toBe(57);
    expect(update.payload.trade.user.username).toBe(user.username);
    expect(update.payload.trade.outcomeLabel).toBe("Yes");
    expect(update.payload.trade.shares).toBe(100);
  });

  it("says nothing to anybody when the trade is refused", async () => {
    const user = await makeUser({ walletBalance: 1 });
    const market = await makeMarket();
    const { app: live, sent } = capturingApp();

    await auth(request(live).post(`/predictions/${market.slug}/trade`), user)
      .send({ outcome: "o1", action: "buy", shares: 5000 });
    expect(sent.broadcast).toHaveLength(0);
    expect(sent.rooms).toHaveLength(0);
  });
});
