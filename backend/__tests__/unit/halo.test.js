const halo = require("../../utils/halo");
const POOL = require("../../data/haloStudents.json");

const student = (over = {}) => ({
  name: "Target",
  rarity: 2,
  type: "Striker",
  role: "Dealer",
  attackType: "Explosive",
  defenseType: "Light",
  academy: "Trinity",
  schoolYear: "2nd Year",
  age: "16",
  height: 155,
  birthday: "4/1",
  hobby: "Reading",
  club: "Tea Party",
  ssrDescription: "Target is a student of Trinity.",
  haloImage: "https://example.com/halo.png",
  studentImage: "https://example.com/portrait.webp",
  gunImage: "https://example.com/gun.webp",
  itemImage: "https://example.com/gear.webp",
  voiceline: "https://example.com/voice.mp3",
  ...over,
});

describe("the answer pool", () => {
  it("has a unique name for every student and no alt outfits", () => {
    const names = POOL.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.some((n) => n.includes("("))).toBe(false);
    expect(halo.POOL_SIZE).toBe(POOL.length);
  });

  it("gives every student what a guess row and a reveal need", () => {
    for (const s of POOL) {
      expect(typeof s.name).toBe("string");
      expect([1, 2, 3]).toContain(s.rarity);
      expect(s.studentImage).toMatch(/^https:\/\//);
    }
  });

  it("keeps every hint out of the searchable list", () => {
    const listed = halo.publicPool()[0];
    for (const field of ["haloImage", "gunImage", "itemImage", "voiceline", "hobby", "club", "birthday", "ssrDescription"]) {
      expect(listed).not.toHaveProperty(field);
    }
    expect(listed).toHaveProperty("academy");
    expect(listed).toHaveProperty("studentImage");
  });

  it("finds a student by name whatever the case or spacing", () => {
    const first = POOL[0];
    expect(halo.studentByName(`  ${first.name.toUpperCase()} `).name).toBe(first.name);
    expect(halo.studentByName("nobody at all")).toBeNull();
  });
});

describe("comparing a guess", () => {
  it("matches everything on the right student", () => {
    const t = student();
    const row = halo.compare(t, t);
    expect(row.correct).toBe(true);
    expect(Object.values(row.matches).every((m) => m === "CORRECT")).toBe(true);
  });

  it("points numbers at the answer and marks everything else right or wrong", () => {
    const row = halo.compare(student(), student({ name: "Guess", rarity: 3, height: 140, age: "18", schoolYear: "1st Year", academy: "Gehenna" }));
    expect(row.correct).toBe(false);
    expect(row.matches.rarity).toBe("LOWER");
    expect(row.matches.height).toBe("HIGHER");
    expect(row.matches.age).toBe("LOWER");
    expect(row.matches.schoolYear).toBe("HIGHER");
    expect(row.matches.academy).toBe("WRONG");
    expect(row.matches.role).toBe("CORRECT");
  });

  it("only matches an unknown number with another unknown", () => {
    expect(halo.compare(student({ age: "Unknown" }), student({ name: "G", age: "Unknown" })).matches.age).toBe("CORRECT");
    expect(halo.compare(student({ age: "Unknown" }), student({ name: "G", age: "15" })).matches.age).toBe("WRONG");
    expect(halo.compare(student({ height: 0 }), student({ name: "G", height: 150 })).matches.height).toBe("WRONG");
  });
});

describe("hints", () => {
  it("opens one per miss, and sends nothing for a locked hint", () => {
    const none = halo.hintsFor(student(), 0);
    expect(none.every((h) => !h.unlocked && h.image === undefined && h.text === undefined && h.audio === undefined)).toBe(true);

    const two = halo.hintsFor(student(), 2);
    expect(two.filter((h) => h.unlocked).map((h) => h.key)).toEqual(["halo", "hobby"]);
    expect(two.find((h) => h.key === "hobby").text).toBe("Reading");
    expect(two.find((h) => h.key === "weapon").image).toBeUndefined();
  });

  it("moves later hints up when a student has no halo and no readable hobby", () => {
    const hints = halo.hintsFor(student({ haloImage: "", hobby: "Unknown" }), 1);
    const byKey = Object.fromEntries(hints.map((h) => [h.key, h]));
    expect(byKey.halo.unlocked).toBe(true);
    expect(byKey.halo.available).toBe(false);
    expect(byKey.hobby.unlockAt).toBe(1);
    expect(byKey.weapon.unlockAt).toBe(1);
    expect(byKey.weapon.image).toBe("https://example.com/gun.webp");
  });

  it("hides the student's own name in the profile text", () => {
    const hints = halo.hintsFor(student(), 10);
    expect(hints.find((h) => h.key === "profile").text).toBe("**** is a student of Trinity.");
  });

  it("treats japanese-only text as unreadable", () => {
    expect(halo.isReadableHint("読書")).toBe(false);
    expect(halo.isReadableHint("Reading")).toBe(true);
    expect(halo.isReadableHint("Unknown")).toBe(false);
  });
});

describe("scoring a whole game", () => {
  const [a, b, c, d] = POOL;

  it("drops unknown and repeated names", () => {
    const result = halo.evaluate(d, [a.name, "not a student", a.name, b.name]);
    expect(result.names).toEqual([a.name, b.name]);
    expect(result.finished).toBe(false);
    expect(result.hints.filter((h) => h.unlocked).length).toBeGreaterThan(0);
  });

  it("wins on the right name and ignores anything after it", () => {
    const result = halo.evaluate(c, [a.name, c.name, b.name]);
    expect(result.names).toEqual([a.name, c.name]);
    expect(result.won).toBe(true);
    expect(result.finished).toBe(true);
    expect(result.hints).toEqual([]);
  });

  it("loses after ten misses and counts nothing past them", () => {
    const misses = POOL.filter((s) => s.name !== a.name).slice(0, 12).map((s) => s.name);
    const result = halo.evaluate(a, [...misses, a.name]);
    expect(result.guesses).toHaveLength(halo.MAX_GUESSES);
    expect(result.lost).toBe(true);
    expect(result.won).toBe(false);
  });

  it("is not a list at all when someone sends garbage", () => {
    expect(halo.evaluate(a, "Shiroko").guesses).toEqual([]);
    expect(halo.evaluate(a, null).finished).toBe(false);
  });
});

describe("what a win pays", () => {
  it("pays more for fewer guesses", () => {
    expect(halo.rewardFor(1, 1)).toBe(1000);
    expect(halo.rewardFor(2, 1)).toBe(930);
    expect(halo.rewardFor(10, 1)).toBe(370);
  });

  it("adds a streak bonus from the second day, up to its cap", () => {
    expect(halo.rewardFor(1, 2)).toBe(1050);
    expect(halo.rewardFor(1, 11)).toBe(1500);
    expect(halo.rewardFor(1, 90)).toBe(1500);
  });
});

describe("a player's record", () => {
  it("keeps a streak alive until the day after its last win", () => {
    const stored = { played: 5, wins: 4, currentStreak: 3, bestStreak: 4, lastWonDay: 100, distribution: [1, 2] };
    expect(halo.liveStats(stored, 101).currentStreak).toBe(3);
    expect(halo.liveStats(stored, 102).currentStreak).toBe(0);
    expect(halo.liveStats(stored, 101).distribution).toHaveLength(halo.MAX_GUESSES);
    expect(halo.liveStats(null, 5)).toEqual({ played: 0, wins: 0, currentStreak: 0, bestStreak: 0, distribution: Array(10).fill(0) });
  });
});
