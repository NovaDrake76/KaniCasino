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

  // a first google sign-in no longer creates the account: it hands back a ticket, and the
  // account is made once the player has chosen a nickname and a picture. consent is taken
  // at that second step, which is the one that creates anything.
  const finish = (ticket, username, body = {}) =>
    request(app).post("/users/google/complete").send({ ticket, username, ...body });

  const signUpWithGoogle = async (body = {}) => {
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `g-${s}`, picture: "p.png", sub: `sub-${s}` };
    const started = await googleLogin({});
    return { email: mockGooglePayload.email, res: await finish(started.body.ticket, `g-${s}`, body) };
  };

  it("hands back a ticket rather than creating the account", async () => {
    const s = uniqueSuffix();
    mockGooglePayload = { email: `g-${s}@x.com`, name: `g-${s}`, picture: "p.png", sub: `sub-${s}` };

    const res = await googleLogin({});

    expect(res.status).toBe(200);
    expect(res.body.needsProfile).toBe(true);
    expect(res.body.ticket).toBeTruthy();
    expect(res.body.suggested.username).toBeTruthy();
    expect(await User.findOne({ email: mockGooglePayload.email })).toBeNull();
  });

  it("keeps the ticked box on the step that creates the account", async () => {
    const { email, res } = await signUpWithGoogle({ marketingOptIn: true });
    expect(res.status).toBe(200);

    const user = await User.findOne({ email });
    expect(user.marketingOptIn).toBe(true);
    expect(user.marketingOptInAt).toBeInstanceOf(Date);
  });

  it("defaults to off without one", async () => {
    const { email } = await signUpWithGoogle({});

    expect((await User.findOne({ email })).marketingOptIn).toBe(false);
  });

  // consent belongs to the signup, so a later sign-in must not speak for the account
  it("never rewrites the choice of someone who already has an account", async () => {
    const { email } = await signUpWithGoogle({ marketingOptIn: true });

    await googleLogin({ marketingOptIn: false });
    expect((await User.findOne({ email })).marketingOptIn).toBe(true);

    await User.updateOne({ email }, { $set: { marketingOptIn: false } });
    await googleLogin({ marketingOptIn: true });
    expect((await User.findOne({ email })).marketingOptIn).toBe(false);
  });

  it("logs a returning player straight in, with no second step", async () => {
    const { email } = await signUpWithGoogle({});

    const again = await googleLogin({});

    expect(again.body.needsProfile).toBeUndefined();
    expect(again.body.token).toBeTruthy();
    expect(await User.countDocuments({ email })).toBe(1);
  });
});
