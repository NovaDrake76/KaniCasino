const fs = require("node:fs");
const path = require("node:path");
const { EVENTS, MAX_EVENTS, DAILY_CAP, cleanBatch, createBudget } = require("../../utils/usage");

const USER = "64b000000000000000000001";
const NOW = Date.parse("2026-09-23T12:00:00Z");
const clean = (body) => cleanBatch(body, USER, NOW);
const one = (event) => clean({ sid: "abc123", events: [event] });

describe("what a usage batch is allowed to store", () => {
  it("keeps a known event with its params, stamped from the server's clock less the time it waited", () => {
    const [doc] = one({ name: "daisu_open", params: { via: "bubble", showing: "gift", attention: true }, path: "/dice", ago: 4000 });

    expect(doc).toEqual({
      userId: USER,
      name: "daisu_open",
      params: { via: "bubble", showing: "gift", attention: true },
      path: "/dice",
      sid: "abc123",
      at: new Date(NOW - 4000),
    });
  });

  it("drops an event it does not know, and a name that is only an object's own machinery", () => {
    expect(one({ name: "anything_at_all", params: {} })).toEqual([]);
    expect(one({ name: "__proto__", params: {} })).toEqual([]);
    expect(one({ name: "constructor", params: {} })).toEqual([]);
    expect(one(null)).toEqual([]);
  });

  it("keeps only the params an event declares, of a plain type, and cuts text short", () => {
    const [doc] = one({
      name: "shop_item",
      params: { item: "x".repeat(200), state: { nested: true }, via: "shelf", extra: "not allowed", status: 5 },
    });

    expect(doc.params).toEqual({ item: "x".repeat(40), via: "shelf" });
  });

  it("will not hold more than a batch's worth, or trust a clock far from the server's", () => {
    const many = Array.from({ length: MAX_EVENTS + 30 }, () => ({ name: "tour_step", params: { step: "pot" } }));
    expect(clean({ events: many })).toHaveLength(MAX_EVENTS);

    expect(one({ name: "tour_step", params: { step: "pot" }, ago: 86400000 })[0].at).toEqual(new Date(NOW - 10 * 60 * 1000));
    expect(one({ name: "tour_step", params: { step: "pot" }, ago: -5000 })[0].at).toEqual(new Date(NOW));
    expect(one({ name: "tour_step", params: { step: "pot" }, ago: "soon" })[0].at).toEqual(new Date(NOW));
  });

  it("drops a path that is not one and a session id that is not plain", () => {
    const [doc] = cleanBatch({ sid: "<script>", events: [{ name: "tour_step", params: { step: "pot" }, path: "https://evil.example/" }] }, USER, NOW);

    expect(doc.path).toBeNull();
    expect(doc.sid).toBeNull();
    expect(cleanBatch(undefined, USER, NOW)).toEqual([]);
  });

  it("lets one account write only so much a day, each account on its own budget, and starts over the next day", () => {
    const take = createBudget(5);
    const day = Date.parse("2026-09-23T10:00:00Z");

    expect(take("a", 3, day)).toBe(3);
    expect(take("a", 3, day)).toBe(2);
    expect(take("a", 3, day)).toBe(0);
    expect(take("b", 4, day)).toBe(4);
    expect(take("a", 3, day + 86400000)).toBe(3);
    expect(DAILY_CAP).toBeGreaterThanOrEqual(500);
  });

  // the page declares the same list in typescript; an event the server does not know is silently dropped, so they must not drift
  it("allows exactly the events and params the page sends", () => {
    const source = fs.readFileSync(path.join(__dirname, "../../../src/services/usage/usage.ts"), "utf8");
    const block = source.slice(source.indexOf("export interface UsageEvents {"), source.indexOf("\n}\n", source.indexOf("export interface UsageEvents {")));
    const page = {};
    for (const [, name, body] of block.matchAll(/^\s+(\w+): \{([^}]*)\};$/gm)) {
      page[name] = [...body.matchAll(/(\w+)\??:/g)].map((m) => m[1]).sort();
    }
    const server = Object.fromEntries(Object.entries(EVENTS).map(([name, params]) => [name, [...params].sort()]));

    expect(Object.keys(page).length).toBeGreaterThan(0);
    expect(page).toEqual(server);
  });
});
