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
const nameFilter = require("../../utils/nameFilter");
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
  // the account is created by the finishing step now, and the name it offers is what the
  // filter has already been through
  const finish = (ticket, username) =>
    request(app).post("/users/google/complete").send({ ticket, username });

  it("keeps a display name that is fine", async () => {
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `Mohamed ${s}`, picture: "p.png", sub: `sub-${s}` };

    const started = await googleLogin();

    expect(started.status).toBe(200);
    expect(started.body.suggested.username).toBe(`Mohamed ${s}`);
    await finish(started.body.ticket, started.body.suggested.username);
    expect((await User.findOne({ email: mockGooglePayload.email })).username).toBe(`Mohamed ${s}`);
  });

  // a google display name cannot be edited to get past the filter, so offering a clean one
  // beats refusing the sign-in and locking the person out of their own account
  it("offers a clean name rather than refusing the sign-in", async () => {
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: "n*gga", picture: "p.png", sub: `sub-${s}` };

    const started = await googleLogin();

    expect(started.status).toBe(200);
    expect(nameFilter.isClean(started.body.suggested.username)).toBe(true);
    expect(started.body.suggested.username).not.toBe("n*gga");
  });

  it("still refuses a slur the player types into the finishing step themselves", async () => {
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `Fine Name ${s}`, picture: "p.png", sub: `sub-${s}` };
    const started = await googleLogin();

    const res = await finish(started.body.ticket, "n1gg3r");

    expect(res.status).toBe(400);
    expect(await User.findOne({ email: mockGooglePayload.email })).toBeNull();
  });
});
