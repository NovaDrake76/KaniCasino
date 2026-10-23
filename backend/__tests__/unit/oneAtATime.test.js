const express = require("express");
const request = require("supertest");
const { oneAtATime, makeLane, MAX_WAITING } = require("../../middleware/oneAtATime");

// a bet route that takes a while, counting how many run at once, per player and overall
function makeApp(delayMs = 15, lane = oneAtATime) {
  const running = new Map();
  const most = new Map();
  let all = 0;
  const seen = { all: 0, placed: 0, starts: [] };
  const app = express();
  app.use((req, res, next) => {
    req.user = { _id: req.header("x-player") };
    next();
  });
  app.post("/bet", lane, async (req, res) => {
    const id = req.user._id;
    seen.placed += 1;
    seen.starts.push({ id, at: Date.now() });
    running.set(id, (running.get(id) || 0) + 1);
    most.set(id, Math.max(most.get(id) || 0, running.get(id)));
    all += 1;
    seen.all = Math.max(seen.all, all);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    running.set(id, running.get(id) - 1);
    all -= 1;
    res.json({ ok: true });
  });
  return { app, most, seen };
}

const bet = (app, player) => request(app).post("/bet").set("x-player", player);

describe("one bet at a time per player", () => {
  it("runs a burst from one player one request after another, and answers every one", async () => {
    const { app, most } = makeApp();

    const answers = await Promise.all(Array.from({ length: 6 }, () => bet(app, "a")));

    expect(answers.map((r) => r.status)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(most.get("a")).toBe(1);
  });

  it("does not make one player wait on another", async () => {
    const { app, most, seen } = makeApp(40);

    await Promise.all([...Array.from({ length: 3 }, () => bet(app, "a")), ...Array.from({ length: 3 }, () => bet(app, "b"))]);

    expect(most.get("a")).toBe(1);
    expect(most.get("b")).toBe(1);
    expect(seen.all).toBe(2);
  });

  it("turns away what is past the queue's length instead of stacking it", async () => {
    const { app } = makeApp(150);

    const answers = await Promise.all(Array.from({ length: MAX_WAITING + 4 }, () => bet(app, "a")));

    expect(answers.filter((r) => r.status === 200)).toHaveLength(MAX_WAITING);
    expect(answers.filter((r) => r.status === 429)).toHaveLength(4);
  });

  it("never places a bet whose player left while it waited", async () => {
    const { app, seen } = makeApp(200);

    // a supertest request only goes out once something waits on it
    const first = bet(app, "c").then((r) => r);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const left = bet(app, "c").timeout(50).catch((err) => err);
    expect((await left).timeout).toBe(50);
    expect((await first).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(seen.placed).toBe(1);
  });
});

describe("one bet a second per player", () => {
  const GAP = 200;
  const startsOf = (seen, id) => seen.starts.filter((s) => s.id === id).map((s) => s.at);

  it("spaces a burst from one player a gap apart", async () => {
    const { app, seen } = makeApp(15, makeLane({ gapMs: GAP }));

    const answers = await Promise.all(Array.from({ length: 3 }, () => bet(app, "a")));

    expect(answers.map((r) => r.status)).toEqual([200, 200, 200]);
    const [first, second, third] = startsOf(seen, "a");
    expect(second - first).toBeGreaterThanOrEqual(GAP - 5);
    expect(third - second).toBeGreaterThanOrEqual(GAP - 5);
  });

  it("holds a bet sent the moment the last one answered", async () => {
    const { app, seen } = makeApp(15, makeLane({ gapMs: GAP }));

    await bet(app, "a");
    await bet(app, "a");

    const [first, second] = startsOf(seen, "a");
    expect(second - first).toBeGreaterThanOrEqual(GAP - 5);
  });

  it("never holds one player for another's gap", async () => {
    // a long gap, so a loaded test machine cannot pass for a held bet
    const { app, seen } = makeApp(15, makeLane({ gapMs: 2000 }));

    await Promise.all([bet(app, "a"), bet(app, "b")]);

    const [a] = startsOf(seen, "a");
    const [b] = startsOf(seen, "b");
    expect(Math.abs(a - b)).toBeLessThan(1000);
  });
});
