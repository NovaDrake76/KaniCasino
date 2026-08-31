const gift = require("../../utils/dailyGift");

const mk = (id, price, title = `case-${id}`) => ({ _id: id, price, title, image: "i.webp" });

// the five real categories, reduced to their price shapes
const CATALOGUE = {
  "Uma Musume": [mk(1, 30), mk(2, 30), mk(3, 40), mk(4, 45), mk(5, 50)],
  "Blue Archive": [mk(6, 30), mk(7, 45), mk(8, 45), mk(9, 45)],
  Touhou: [mk(10, 60), mk(11, 60), mk(12, 12000)],
  Animals: [mk(13, 40), mk(14, 120)],
  "Counter-Strike": [mk(15, 15), mk(16, 130), mk(17, 352), mk(18, 690), mk(19, 1859), mk(20, 1324450)],
};

describe("who is eligible", () => {
  it("drops the grails, so a daily can never be an economy event", () => {
    const ids = gift.eligible(CATALOGUE["Counter-Strike"]).map((c) => c._id);
    expect(ids).not.toContain(20);
    expect(gift.eligible(CATALOGUE.Touhou).map((c) => c._id)).not.toContain(12);
  });

  it("keeps everything at or under the cap, cheapest first", () => {
    const prices = gift.eligible(CATALOGUE["Counter-Strike"]).map((c) => c.price);
    expect(Math.max(...prices)).toBeLessThanOrEqual(gift.MAX_CASE_PRICE);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("gives an empty table when nothing qualifies, instead of guessing", () => {
    expect(gift.tableFor([mk(99, 999999)])).toEqual([]);
  });
});

describe("a category's table", () => {
  const tables = Object.fromEntries(
    Object.entries(CATALOGUE).map(([k, v]) => [k, gift.tableFor(v)])
  );

  it("has one prize per slot", () => {
    for (const t of Object.values(tables)) expect(t).toHaveLength(gift.SLOTS.length);
  });

  it("never hands out more openings than the cap", () => {
    for (const t of Object.values(tables)) {
      for (const s of t) expect(s.opens).toBeGreaterThanOrEqual(1);
      for (const s of t) expect(s.opens).toBeLessThanOrEqual(gift.MAX_OPENS);
    }
  });

  // the jackpot has to be visibly better than the slot below it, or there is nothing
  // to almost hit and the spin stops being a spin
  it("gets strictly more valuable toward the rare end", () => {
    for (const [name, t] of Object.entries(tables)) {
      for (let i = 1; i < t.length; i++) {
        expect(`${name} slot ${i}: ${t[i].value}`).toBe(`${name} slot ${i}: ${t[i].value}`);
        expect(t[i].value).toBeGreaterThan(t[i - 1].value);
      }
    }
  });

  it("shows off the category instead of naming one case six times", () => {
    for (const [name, t] of Object.entries(tables)) {
      const distinctCases = new Set(t.map((s) => s.caseId)).size;
      const available = gift.eligible(CATALOGUE[name]).length;
      expect(distinctCases).toBeGreaterThanOrEqual(Math.min(2, available));
    }
  });

  it("survives a category holding a single case, which is the Animals case tomorrow", () => {
    const t = gift.tableFor([mk(1, 40)]);
    expect(t).toHaveLength(gift.SLOTS.length);
    expect(new Set(t.map((s) => s.caseId)).size).toBe(1);
    expect(t[5].opens).toBeGreaterThan(t[0].opens);
  });
});

// this is the whole design: picking the theme you actually collect must not cost you
describe("expected value across categories", () => {
  const evs = Object.entries(CATALOGUE).map(([name, cases]) => ({
    name,
    ev: gift.expectedValue(gift.tableFor(cases), 0),
  }));

  it("lands every category in the same band", () => {
    const values = evs.map((e) => e.ev);
    const spread = Math.max(...values) / Math.min(...values);
    expect(spread).toBeLessThan(1.35);
  });

  it("is worth real money to the median wallet, which holds about 175 KP", () => {
    for (const { ev } of evs) expect(ev).toBeGreaterThan(300);
  });

  it("stays far below what a grail would have injected", () => {
    for (const { ev } of evs) expect(ev).toBeLessThan(5000);
  });
});

describe("the streak", () => {
  const table = gift.tableFor(CATALOGUE["Uma Musume"]);

  const d = (s) => new Date(s);

  it("counts days and resets when one is missed", () => {
    expect(gift.nextStreak(0, null, d("2026-07-02T10:00:00Z"))).toBe(1);
    expect(gift.nextStreak(3, d("2026-07-01T10:00:00Z"), d("2026-07-02T10:00:00Z"))).toBe(4);
    expect(gift.nextStreak(3, d("2026-07-02T08:00:00Z"), d("2026-07-02T23:00:00Z"))).toBe(3);
    expect(gift.nextStreak(9, d("2026-06-29T10:00:00Z"), d("2026-07-02T10:00:00Z"))).toBe(1);
  });

  it("cuts the day at the reset hour, not at midnight", () => {
    // 01:00 falls before the 06:00 cut, so it belongs to the day that started the
    // previous morning and 23:00 the same evening is already the next one
    expect(gift.dayIndex(d("2026-07-02T01:00:00Z"))).toBe(gift.dayIndex(d("2026-07-01T12:00:00Z")));
    expect(gift.nextStreak(3, d("2026-07-02T01:00:00Z"), d("2026-07-02T23:00:00Z"))).toBe(4);
  });

  it("holds the window still instead of walking it later every day", () => {
    // the rolling cooldown drifted: a spin at 21:00 pushed the next one to 21:00, and any
    // lateness rode forward, until the slot landed at an hour the player was never online.
    // a player who spins later and later now keeps the same boundary and the same streak.
    let last = d("2026-07-01T21:00:00Z");
    let streak = 1;
    for (const at of ["2026-07-02T22:30:00Z", "2026-07-03T23:40:00Z", "2026-07-04T23:55:00Z"]) {
      const now = d(at);
      expect(gift.claimableAt(last).getTime()).toBeLessThanOrEqual(now.getTime());
      streak = gift.nextStreak(streak, last, now);
      last = now;
    }
    expect(streak).toBe(4);
  });

  it("opens the next spin at the coming reset, whenever the last one landed", () => {
    expect(gift.nextResetAt(d("2026-07-02T05:59:00Z")).toISOString()).toBe("2026-07-02T06:00:00.000Z");
    expect(gift.nextResetAt(d("2026-07-02T06:00:00Z")).toISOString()).toBe("2026-07-03T06:00:00.000Z");
    expect(gift.nextResetAt(d("2026-07-02T23:00:00Z")).toISOString()).toBe("2026-07-03T06:00:00.000Z");
  });

  it("still refuses a second spin inside the same day", () => {
    const first = d("2026-07-02T07:00:00Z");
    expect(gift.isClaimable(first, d("2026-07-02T20:00:00Z"))).toBe(false);
    expect(gift.isClaimable(first, d("2026-07-03T05:59:00Z"))).toBe(false);
    expect(gift.isClaimable(first, d("2026-07-03T06:00:00Z"))).toBe(true);
  });

  it("tilts the odds toward the rare slots without touching what they pay", () => {
    const cold = gift.weightsFor(table, 0);
    const hot = gift.weightsFor(table, 10);
    const share = (w) => w[w.length - 1] / w.reduce((a, b) => a + b, 0);

    expect(share(hot)).toBeGreaterThan(share(cold));
    // the ceiling is fixed: a streak must never turn the daily into a power-up
    expect(gift.tableFor(CATALOGUE["Uma Musume"]).map((s) => s.value)).toEqual(
      table.map((s) => s.value)
    );
  });

  it("raises the expected value, but nowhere near double", () => {
    const cold = gift.expectedValue(table, 0);
    const hot = gift.expectedValue(table, 30);
    expect(hot).toBeGreaterThan(cold);
    expect(hot / cold).toBeLessThan(1.6);
  });

  it("stops tilting once it caps", () => {
    expect(gift.streakTilt(400)).toBe(gift.MAX_STREAK_TILT);
  });
});

describe("picking a slot from a roll", () => {
  const table = gift.tableFor(CATALOGUE["Counter-Strike"]);
  const TOTAL = 100000;

  it("covers the whole roll space and reaches every slot", () => {
    const seen = new Set();
    for (let r = 1; r <= TOTAL; r += 97) seen.add(gift.pickSlot(table, r, TOTAL, 0).value);
    expect(seen.size).toBe(table.length);
  });

  it("hits the jackpot about as often as its weight says", () => {
    const top = table[table.length - 1];
    let hits = 0;
    for (let r = 1; r <= TOTAL; r++) if (gift.pickSlot(table, r, TOTAL, 0).value === top.value) hits++;
    const observed = (hits / TOTAL) * 100;
    const weights = gift.weightsFor(table, 0);
    const expected = (weights[weights.length - 1] / weights.reduce((a, b) => a + b, 0)) * 100;
    expect(Math.abs(observed - expected)).toBeLessThan(0.5);
  });

  it("is a pure function of the roll, so the audit record reproduces it", () => {
    expect(gift.pickSlot(table, 42424, TOTAL, 3)).toEqual(gift.pickSlot(table, 42424, TOTAL, 3));
  });
});

describe("the top slot", () => {
  it("gives a fresh account only the bottom rungs, and shows the rest locked", () => {
    const wheel = gift.topSlotFor(0);
    expect(wheel).toHaveLength(gift.TOP_SLOT.length);
    expect(wheel.filter((t) => !t.locked).map((t) => t.multiplier)).toEqual([1, 2]);
  });

  it("unlocks a rung at each gate, and stops at the top", () => {
    expect(gift.topSlotFor(10).filter((t) => !t.locked)).toHaveLength(3);
    expect(gift.topSlotFor(30).filter((t) => !t.locked)).toHaveLength(4);
    expect(gift.topSlotFor(60).filter((t) => !t.locked)).toHaveLength(5);
    expect(gift.topSlotFor(100).filter((t) => !t.locked)).toHaveLength(6);
    expect(gift.topSlotFor(166).filter((t) => !t.locked)).toHaveLength(6);
  });

  it("never rolls a rung the level has not earned", () => {
    const wheel = gift.topSlotFor(0);
    for (let r = 1; r <= 100000; r += 13) {
      expect(gift.pickTopSlot(wheel, r, 100000, 30).locked).toBe(false);
    }
  });

  // level decides how high it goes, streak decides how often it fires. keeping those
  // separate is what makes both legible to a player
  it("pays more the higher the level, at a fixed streak", () => {
    const at = (lv) => gift.topSlotAverage(lv, 0);
    expect(at(10)).toBeGreaterThan(at(0));
    expect(at(30)).toBeGreaterThan(at(10));
    expect(at(60)).toBeGreaterThan(at(30));
  });

  it("fires more often the longer the streak, at a fixed level", () => {
    const wheel = gift.topSlotFor(60);
    const nothing = (streak) => {
      const w = gift.topSlotWeights(wheel, streak);
      return w[0] / w.reduce((a, b) => a + b, 0);
    };
    expect(nothing(10)).toBeLessThan(nothing(0));
  });

  it("still leaves a real chance of nothing, so the hit means something", () => {
    const wheel = gift.topSlotFor(60);
    const w = gift.topSlotWeights(wheel, 30);
    expect(w[0] / w.reduce((a, b) => a + b, 0)).toBeGreaterThan(0.25);
  });

  it("keeps the day bounded, whatever the level and streak", () => {
    const table = gift.tableFor([
      { _id: 1, price: 30, title: "a", image: "i" },
      { _id: 2, price: 45, title: "b", image: "i" },
    ]);
    const ceiling = gift.ceilingFor(table, 999);
    const best = Math.max(...table.map((s) => s.value));
    expect(ceiling).toBe(best * 25);
    // the whole point of the cap: one day can never rewrite a wallet
    expect(ceiling).toBeLessThan(100000);
  });

  it("is a pure function of the roll, so the audit record reproduces it", () => {
    const wheel = gift.topSlotFor(60);
    expect(gift.pickTopSlot(wheel, 77777, 100000, 4)).toEqual(
      gift.pickTopSlot(wheel, 77777, 100000, 4)
    );
  });
});

describe("the discord boost", () => {
  const table = gift.tableFor(CATALOGUE["Uma Musume"]);
  const rareShare = (w) => w[w.length - 1] / w.reduce((a, b) => a + b, 0);

  it("lifts the rare slots the way a streak does, without touching what they pay", () => {
    const off = gift.weightsFor(table, 0, false);
    const on = gift.weightsFor(table, 0, true);

    expect(rareShare(on)).toBeGreaterThan(rareShare(off));
    expect(gift.tableFor(CATALOGUE["Uma Musume"]).map((s) => s.value)).toEqual(table.map((s) => s.value));
  });

  it("is worth having at a full streak too, so it never becomes a head start", () => {
    const full = gift.STREAK_DAYS;
    const off = gift.weightsFor(table, full, false);
    const on = gift.weightsFor(table, full, true);

    expect(rareShare(on)).toBeGreaterThan(rareShare(off));
  });

  it("adds to the streak rather than replacing it", () => {
    expect(gift.totalTilt(0, false)).toBe(0);
    expect(gift.totalTilt(0, true)).toBe(gift.DISCORD_TILT);
    expect(gift.totalTilt(5, true)).toBeCloseTo(gift.streakTilt(5) + gift.DISCORD_TILT, 10);
  });

  it("raises the average top slot without unlocking a rung the level has not earned", () => {
    expect(gift.topSlotAverage(0, 0, true)).toBeGreaterThan(gift.topSlotAverage(0, 0, false));
    // level 0 sees two rungs whatever discord says, so the ceiling is still the level's
    expect(gift.topSlotFor(0).filter((r) => !r.locked)).toHaveLength(2);
    expect(gift.topSlotAverage(0, 99, true)).toBeLessThanOrEqual(2);
  });
});

describe("the streak ladder", () => {
  it("is a week long and tops out on the last day of it", () => {
    expect(gift.STREAK_DAYS).toBe(7);
    expect(gift.streakTilt(gift.STREAK_DAYS)).toBeCloseTo(gift.MAX_STREAK_TILT, 10);
  });

  it("gains the same amount every day up to the cap, and nothing after", () => {
    const steps = Array.from({ length: gift.STREAK_DAYS }, (_, i) => gift.streakTilt(i + 1) - gift.streakTilt(i));
    steps.forEach((step) => expect(step).toBeCloseTo(gift.STREAK_STEP, 10));
    expect(gift.streakTilt(99)).toBe(gift.MAX_STREAK_TILT);
  });
});

describe("the streak a player actually holds", () => {
  const d = (t) => new Date(t);

  it("is gone the moment a day is missed, whatever the document still says", () => {
    // giftStreak is only rewritten when a spin lands, so a player who stopped days ago
    // still carries a full streak on their document. the card must not believe it.
    expect(gift.liveStreak(7, d("2026-07-01T10:00:00Z"), d("2026-07-05T10:00:00Z"))).toBe(0);
  });

  it("survives the day after, which is the day they can still save it", () => {
    expect(gift.liveStreak(7, d("2026-07-01T10:00:00Z"), d("2026-07-02T10:00:00Z"))).toBe(7);
  });

  it("holds inside the same day, when the spin is already taken", () => {
    expect(gift.liveStreak(3, d("2026-07-02T08:00:00Z"), d("2026-07-02T20:00:00Z"))).toBe(3);
  });

  it("is nothing at all before the first spin", () => {
    expect(gift.liveStreak(0, null, d("2026-07-02T10:00:00Z"))).toBe(0);
  });

  it("agrees with what the next spin will roll on", () => {
    // a broken streak reads as 0 banked and 1 pending: the ladder shows nothing earned
    // and the spin rolls day one. the two used to disagree, so the page advertised
    // day-seven odds on a roll that took day-one ones.
    const stale = [7, d("2026-07-01T10:00:00Z"), d("2026-07-05T10:00:00Z")];
    expect(gift.liveStreak(...stale)).toBe(0);
    expect(gift.nextStreak(...stale)).toBe(1);

    const kept = [3, d("2026-07-01T10:00:00Z"), d("2026-07-02T10:00:00Z")];
    expect(gift.liveStreak(...kept)).toBe(3);
    expect(gift.nextStreak(...kept)).toBe(4);
  });
});
