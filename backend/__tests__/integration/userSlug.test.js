process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const makeUser = (username, extra = {}) =>
  User.create({
    username,
    email: `${uniqueSuffix()}@example.com`,
    password: "x",
    ...extra,
  });

describe("a profile addressed by slug", () => {
  it("resolves by slug", async () => {
    const user = await makeUser("Reimu", { slug: "reimu" });

    const res = await request(app).get("/users/reimu");

    expect(res.status).toBe(200);
    expect(String(res.body._id)).toBe(String(user._id));
    expect(res.body.slug).toBe("reimu");
  });

  it("still resolves by id, so every link ever shared keeps working", async () => {
    const user = await makeUser("Reimu", { slug: "reimu" });

    const res = await request(app).get(`/users/${user._id}`);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("Reimu");
  });

  // ObjectId.isValid() passes any 12-character string, so a naive resolver would send
  // these into findById and 404 them
  it("resolves a 12-character username instead of mistaking it for an id", async () => {
    await makeUser("koishitivity", { slug: "koishitivity" });

    const res = await request(app).get("/users/koishitivity");

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("koishitivity");
  });

  it("serves the inventory by slug as well as by id", async () => {
    const user = await makeUser("Reimu", { slug: "reimu" });

    const bySlug = await request(app).get("/users/inventory/reimu?grouped=true");
    const byId = await request(app).get(`/users/inventory/${user._id}?grouped=true`);

    expect(bySlug.status).toBe(200);
    expect(byId.status).toBe(200);
    expect(bySlug.body.totalPages).toBe(byId.body.totalPages);
  });

  it("hands back nothing for a slug nobody holds", async () => {
    const res = await request(app).get("/users/nobody-by-that-name");
    expect(res.body).toBeNull();
  });

  it("keeps a disabled account hidden whichever way it is addressed", async () => {
    const user = await makeUser("Ghost", { slug: "ghost", disabled: true });

    expect((await request(app).get("/users/ghost")).body).toBeNull();
    expect((await request(app).get(`/users/${user._id}`)).body).toBeNull();
  });
});

describe("registration", () => {
  const register = (username) =>
    request(app).post("/users/register").send({
      username,
      email: `${uniqueSuffix()}@example.com`,
      password: "password123",
    });

  it("mints a slug for a new account", async () => {
    await register("Marisa");
    const user = await User.findOne({ username: "Marisa" }).lean();
    expect(user.slug).toBe("marisa");
  });

  it("refuses a name that only differs by case, so one url has one owner", async () => {
    await register("Sakuya");
    const second = await register("sakuya");
    expect(second.status).toBe(400);
  });

  it("refuses a name that only differs by punctuation", async () => {
    await register("LTA_BR");
    const second = await register("LTA BR");
    expect(second.status).toBe(400);
  });

  it("gives no slug to a name it cannot make one from, and still creates the account", async () => {
    const res = await register("오정남");
    expect(res.status).toBe(200);
    const user = await User.findOne({ username: "오정남" }).lean();
    expect(user.slug).toBeUndefined();
  });

  // the index is unique AND sparse: 59 accounts on file can have no slug at all, and a
  // plain unique index would let only one of them exist
  it("lets any number of accounts hold no slug", async () => {
    await User.init();
    const first = await register("오정남");
    const second = await register("Иван Курапов");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await User.countDocuments({ slug: { $exists: false } })).toBe(2);
  });

  it("never lets a slug take an api path the server already owns", async () => {
    await register("me");
    const user = await User.findOne({ username: "me" }).lean();
    expect(user.slug).toBe("me-2");
  });
});
