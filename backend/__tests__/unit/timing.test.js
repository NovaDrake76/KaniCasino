const { EventEmitter } = require("events");
const timing = require("../../utils/timing");

// a request that finishes after `ms`, on a matched route
const run = async (ms, { method = "GET", baseUrl = "/cases", path = "/", status = 200 } = {}) => {
  const req = { method, baseUrl, route: { path }, path };
  const res = Object.assign(new EventEmitter(), { statusCode: status });
  const realHr = process.hrtime.bigint;
  let now = 0n;
  process.hrtime.bigint = () => now;
  try {
    timing.middleware(req, res, () => {});
    now = BigInt(Math.round(ms * 1e6));
    res.emit("finish");
  } finally {
    process.hrtime.bigint = realHr;
  }
};

describe("the origin's own timings", () => {
  let log;
  beforeEach(async () => {
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    await timing.summarize();
    log.mockClear();
  });
  afterEach(() => log.mockRestore());

  it("names a request that took longer than it should, by route rather than by id", async () => {
    await run(timing.SLOW_MS + 500, { baseUrl: "/cases", path: "/:id" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("slow request: GET /cases/:id"));
  });

  it("stays quiet about a request that was fine", async () => {
    await run(40);
    expect(log).not.toHaveBeenCalled();
  });

  it("reports the percentiles of what it has seen, and that atlas is unreachable when it is", async () => {
    for (const ms of [10, 20, 30, 40, 1000]) await run(ms);
    const health = await timing.health();
    expect(health.requests).toBe(5);
    expect(health.p50Ms).toBe(30);
    expect(health.p95Ms).toBe(1000);
    expect(health.status).toBe("db-down");
    expect(health.dbMs).toBeNull();
  });

  it("writes one summary line for the window and starts the next one empty", async () => {
    await run(25, { baseUrl: "/fandom", path: "/collectors" });
    await timing.summarize();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^origin: 1 req in \d+s, p50 25ms.*slowest GET \/fandom\/collectors 25ms/));
    expect((await timing.health()).requests).toBe(0);
  });
});
