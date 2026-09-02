// the free tier is 512 MB and the database was growing toward it at 20 MB a day, most of it
// audit rows nothing reads twice. each of these collections now expires its rows, and the
// window is pinned here so a schema edit cannot quietly put it back to forever.
const Roll = require("../../models/Roll");
const Round = require("../../models/Round");
const BlackjackHand = require("../../models/BlackjackHand");
const MinesGame = require("../../models/MinesGame");
const HiloGame = require("../../models/HiloGame");

const DAY = 24 * 60 * 60;

// the ttl declared on a schema, or null when the model would keep its rows forever
const ttlOn = (model, field) => {
  const hit = model.schema.indexes().find(([key, opts]) => key[field] !== undefined && opts.expireAfterSeconds != null);
  return hit ? hit[1].expireAfterSeconds : null;
};

describe("what the database is allowed to keep", () => {
  it("lets a roll go after three days", () => {
    // only the fair page reads one, by id, and nobody has asked for one a week old
    expect(ttlOn(Roll, "createdAt")).toBe(3 * DAY);
  });

  it("lets a settled round go after a week", () => {
    // the history strip reads the last fifty and the recovery sweep only unfinished ones
    expect(ttlOn(Round, "createdAt")).toBe(7 * DAY);
  });

  it("lets a finished hand or game go a week after its last touch", () => {
    // the sweeps only look for work still owed, and the roll it produced is the record
    expect(ttlOn(BlackjackHand, "updatedAt")).toBe(7 * DAY);
    expect(ttlOn(MinesGame, "updatedAt")).toBe(7 * DAY);
    expect(ttlOn(HiloGame, "updatedAt")).toBe(7 * DAY);
  });

  it("keeps every one of them for at least a day, so nothing is swept mid-play", () => {
    for (const [model, field] of [[Roll, "createdAt"], [Round, "createdAt"], [BlackjackHand, "updatedAt"], [MinesGame, "updatedAt"], [HiloGame, "updatedAt"]]) {
      expect(ttlOn(model, field)).toBeGreaterThanOrEqual(DAY);
    }
  });
});
