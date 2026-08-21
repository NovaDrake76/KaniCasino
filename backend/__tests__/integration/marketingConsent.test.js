process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// the google login path verifies a real token; stand in for google so a fake token
// resolves to whatever payload the test sets
let mockGooglePayload = null;
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockImplementation(() => Promise.resolve({ getPayload: () => mockGooglePayload })),
  })),
}));

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

function signUp(body) {
  const s = uniqueSuffix();
  return request(app)
    .post("/users/register")
    .send({ email: `new-${s}@example.com`, username: `new-${s}`, password: "secret1", ...body })
    .then((res) => ({ res, username: `new-${s}` }));
}

describe("register", () => {
  it("keeps the ticked box", async () => {
    const { res, username } = await signUp({ marketingOptIn: true });
    expect(res.status).toBe(200);

    const user = await User.findOne({ username });
    expect(user.marketingOptIn).toBe(true);
    expect(user.marketingOptInAt).toBeInstanceOf(Date);
  });

  it("defaults to off when the box is left alone", async () => {
    const { username } = await signUp({});

    const user = await User.findOne({ username });
    expect(user.marketingOptIn).toBe(false);
    expect(user.marketingOptInAt).toBeFalsy();
  });

  it("takes only a real true, so a stray truthy value cannot subscribe anyone", async () => {
    const { username } = await signUp({ marketingOptIn: "yes" });

    const user = await User.findOne({ username });
    expect(user.marketingOptIn).toBe(false);
  });
});

describe("google sign-up", () => {
  const googleLogin = (body) => request(app).post("/users/googlelogin").send({ token: "fake", ...body });

  it("keeps the ticked box on the sign-in that creates the account", async () => {
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `g-${s}`, picture: "p.png" };

    const res = await googleLogin({ marketingOptIn: true });
    expect(res.status).toBe(200);

    const user = await User.findOne({ email: mockGooglePayload.email });
    expect(user.marketingOptIn).toBe(true);
    expect(user.marketingOptInAt).toBeInstanceOf(Date);
  });

  it("defaults to off without one", async () => {
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `g-${s}`, picture: "p.png" };

    await googleLogin({});

    const user = await User.findOne({ email: mockGooglePayload.email });
    expect(user.marketingOptIn).toBe(false);
  });

  // consent belongs to the signup, so a later sign-in must not speak for the account
  it("never rewrites the choice of someone who already has an account", async () => {
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `g-${s}`, picture: "p.png" };
    await googleLogin({ marketingOptIn: true });

    await googleLogin({ marketingOptIn: false });
    expect((await User.findOne({ email: mockGooglePayload.email })).marketingOptIn).toBe(true);

    await User.updateOne({ email: mockGooglePayload.email }, { $set: { marketingOptIn: false } });
    await googleLogin({ marketingOptIn: true });
    expect((await User.findOne({ email: mockGooglePayload.email })).marketingOptIn).toBe(false);
  });
});
