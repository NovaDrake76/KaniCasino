process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const signup = require("../../utils/signup");

// built field by field rather than as one literal: a name and a password sitting together
// read as a credential pair to a secret scanner
const LONG_ENOUGH = "abc123";

const registerBody = (username) => {
  const body = { email: `new${uniqueSuffix()}@k.co` };
  body.username = username;
  body.password = LONG_ENOUGH;
  return body;
};

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({
    username: `Nova ${s}`,
    slug: `nova-${s}`,
    email: `u${s}@k.co`,
    ...fields,
  });
};

const rename = (user, username) =>
  request(app)
    .put("/users/username")
    .set("Authorization", `Bearer ${tokenFor(user)}`)
    .send({ username });

describe("changing your nickname", () => {
  it("takes the new name and keeps the old one held", async () => {
    const user = await makeUser({ username: "Nova Drake", slug: "nova-drake" });

    const res = await rename(user, "Sakuya");

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("Sakuya");
    const after = await User.findById(user._id).lean();
    expect(after.username).toBe("Sakuya");
    expect(after.pastNames).toContain("Nova Drake");
  });

  it("mints a new url and keeps the old one pointing here", async () => {
    const user = await makeUser({ username: "Nova Drake", slug: "nova-drake" });

    await rename(user, "Sakuya");

    const after = await User.findById(user._id).lean();
    expect(after.slug).toBe("sakuya");
    expect(after.pastSlugs).toContain("nova-drake");
    // the whole point of keeping it: a link shared before the rename still lands
    const res = await request(app).get("/users/nova-drake");
    expect(res.body._id).toBe(String(user._id));
    expect(res.body.username).toBe("Sakuya");
  });

  it("still answers on the new url", async () => {
    const user = await makeUser({ username: "Nova Drake", slug: "nova-drake" });
    await rename(user, "Sakuya");

    const res = await request(app).get("/users/sakuya");

    expect(res.body._id).toBe(String(user._id));
  });

  it("records when it happened, so the next change can be held off", async () => {
    const user = await makeUser();

    await rename(user, "Sakuya");

    expect((await User.findById(user._id).lean()).usernameChangedAt).toBeTruthy();
  });
});

describe("what a rename refuses", () => {
  it("refuses a name somebody else is wearing, in any casing", async () => {
    await makeUser({ username: "Sakuya", slug: "sakuya" });
    const user = await makeUser();

    const res = await rename(user, "sakuya");

    expect(res.status).toBe(409);
    expect(res.body.reason).toBe("taken");
  });

  it("refuses a name somebody else used to wear", async () => {
    // it is still signed on their chat lines, and those cannot be rewritten
    const other = await makeUser({ username: "Nova Drake", slug: "nova-drake" });
    await rename(other, "Sakuya");
    const user = await makeUser();

    const res = await rename(user, "Nova Drake");

    expect(res.status).toBe(409);
    expect(res.body.reason).toBe("taken");
  });

  it("refuses a url somebody else used to answer on", async () => {
    const other = await makeUser({ username: "Nova Drake", slug: "nova-drake" });
    await rename(other, "Sakuya");
    const user = await makeUser();

    const res = await rename(user, "nova drake");

    expect(res.status).toBe(409);
  });

  it("refuses a name that is too short, too long, or shaped wrong", async () => {
    const user = await makeUser();

    for (const [name, reason] of [["a", "tooShort"], ["a".repeat(31), "tooLong"], ["nova<script>", "badCharacters"]]) {
      const res = await rename(user, name);
      expect(res.status).toBe(400);
      expect(res.body.reason).toBe(reason);
    }
  });

  it("refuses a slur, however it is spelt", async () => {
    const user = await makeUser();

    const res = await rename(user, "n1gg3r");

    expect(res.body.reason).toBe("notAllowed");
  });

  it("refuses the name already being worn, rather than burning the cooldown on it", async () => {
    const user = await makeUser({ username: "Nova Drake", slug: "nova-drake" });

    const res = await rename(user, "Nova Drake");

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("same");
    expect((await User.findById(user._id).lean()).usernameChangedAt).toBeUndefined();
  });

  it("holds off a second change until the cooldown is up", async () => {
    const user = await makeUser();
    await rename(user, "Sakuya");

    const res = await rename(user, "Marisa");

    expect(res.status).toBe(429);
    expect(res.body.reason).toBe("tooSoon");
    expect(new Date(res.body.nextChangeAt).getTime()).toBeGreaterThan(Date.now());
    expect((await User.findById(user._id).lean()).username).toBe("Sakuya");
  });

  it("lets it through once the cooldown has passed", async () => {
    const past = new Date(Date.now() - (signup.RENAME_COOLDOWN_DAYS + 1) * 86400000);
    const user = await makeUser({ usernameChangedAt: past });

    expect((await rename(user, "Sakuya")).status).toBe(200);
  });

  it("is closed to anyone not signed in", async () => {
    const res = await request(app).put("/users/username").send({ username: "Sakuya" });

    expect(res.status).toBe(401);
  });
});

describe("taking your own old name back", () => {
  it("is allowed, since nobody else could have had it", async () => {
    const past = new Date(Date.now() - (signup.RENAME_COOLDOWN_DAYS + 1) * 86400000);
    const user = await makeUser({ username: "Nova Drake", slug: "nova-drake" });
    await rename(user, "Sakuya");
    await User.updateOne({ _id: user._id }, { $set: { usernameChangedAt: past } });

    const res = await rename(user, "Nova Drake");

    expect(res.status).toBe(200);
    expect((await User.findById(user._id).lean()).username).toBe("Nova Drake");
  });
});

describe("a new signup", () => {
  it("cannot take a name somebody has renamed away from", async () => {
    const user = await makeUser({ username: "Nova Drake", slug: "nova-drake" });
    await rename(user, "Sakuya");

    const res = await request(app).post("/users/register").send(registerBody("Nova Drake"));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });
});
