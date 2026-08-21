process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

let mockGooglePayload = null;
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockImplementation(() => Promise.resolve({ getPayload: () => mockGooglePayload })),
  })),
}));

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Item = require("../../models/Item");

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const signUp = (username) => {
  const s = uniqueSuffix();
  return request(app)
    .post("/users/register")
    .send({ email: `u-${s}@example.com`, username, password: "secret1" });
};

describe("registering", () => {
  it("turns away a slur", async () => {
    const res = await signUp("nigger");
    expect(res.status).toBe(400);
    expect(await User.countDocuments({})).toBe(0);
  });

  it("turns away the spellings that get used instead", async () => {
    for (const name of ["n*gga", "n1gg4", "f4gg0t", "n-i-g-g-e-r", "ch1nk"]) {
      expect((await signUp(name)).status).toBe(400);
    }
    expect(await User.countDocuments({})).toBe(0);
  });

  // saying which term matched would just be instructions for getting around it
  it("does not name the term it matched", async () => {
    const res = await signUp("n*gga");
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("gga");
    expect(res.body.message).toBe("Please choose a different username");
  });

  it("lets an ordinary name through", async () => {
    const res = await signUp(`Reimu-${uniqueSuffix()}`);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("lets a real name that looks like a collision through", async () => {
    for (const name of ["Cockburn", "Scunthorpe", "Analyst", "Negroni"]) {
      const res = await signUp(`${name}${uniqueSuffix()}`);
      expect(res.status).toBe(200);
    }
  });
});

describe("google sign-up", () => {
  const googleLogin = () => request(app).post("/users/googlelogin").send({ token: "fake" });

  it("keeps a display name that is fine", async () => {
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `Mohamed ${s}`, picture: "p.png", sub: `sub-${s}` };
    expect((await googleLogin()).status).toBe(200);
    expect((await User.findOne({ email: mockGooglePayload.email })).username).toBe(`Mohamed ${s}`);
  });

  // a google display name cannot be edited to get past the filter, so refusing the login
  // would lock the person out of their own account rather than fix anything
  it("renames rather than refusing the login", async () => {
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: "n*gga", picture: "p.png", sub: `sub-${s}` };

    const res = await googleLogin();
    expect(res.status).toBe(200);

    const user = await User.findOne({ email: mockGooglePayload.email });
    expect(user).toBeTruthy();
    expect(user.username).not.toMatch(/gga/i);
    expect(user.username).toMatch(/^player/);
  });
});

// a vanity code is set once, never changes, and rides in every link the player shares
describe("the referral code", () => {
  const { setReferralCode } = require("../../utils/referrals");

  async function player() {
    const s = uniqueSuffix();
    return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x" });
  }

  it("turns away a slur", async () => {
    process.env.REFERRALS_ENABLED = "true";
    const user = await player();
    const res = await setReferralCode(user._id, "NIGGA");
    expect(res.code).toBe(400);
    expect((await User.findById(user._id)).referralCode).toBeUndefined();
  });

  it("takes an ordinary code", async () => {
    process.env.REFERRALS_ENABLED = "true";
    const user = await player();
    const res = await setReferralCode(user._id, `REIMU${String(uniqueSuffix()).slice(-4)}`);
    expect(res.code).toBe(200);
  });
});

describe("the pinned item description", () => {
  async function seatedUser() {
    const s = uniqueSuffix();
    const item = await Item.create({ name: "Reimu", image: "r.png", rarity: "4", baseValue: 100 });
    const user = await User.create({
      username: `u-${s}`,
      email: `u-${s}@e.com`,
      password: "x",
      fixedItem: { name: item.name, image: item.image, rarity: item.rarity, description: "hello" },
    });
    return user;
  }

  it("turns away a slur", async () => {
    const user = await seatedUser();
    const res = await request(app)
      .put("/users/fixedItem/description")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ description: "n*gga" });

    expect(res.status).toBe(400);
    expect((await User.findById(user._id)).fixedItem.description).toBe("hello");
  });

  it("takes an ordinary description", async () => {
    const user = await seatedUser();
    const res = await request(app)
      .put("/users/fixedItem/description")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ description: "my favourite shrine maiden" });

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).fixedItem.description).toBe("my favourite shrine maiden");
  });

  it("checks what it stores, not what was sent, so the crop cannot smuggle one in", async () => {
    const user = await seatedUser();
    // the tail is dropped by the 50 char crop, so it is the head that has to be clean
    const res = await request(app)
      .put("/users/fixedItem/description")
      .set("Authorization", `Bearer ${tokenFor(user)}`)
      .send({ description: "a".repeat(50) + " nigger" });

    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).fixedItem.description).toBe("a".repeat(50));
  });
});
