process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.SITE_URL = "https://site.example.com";

const mockSent = [];
jest.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    async send(cmd) {
      mockSent.push(cmd.input);
      return {};
    }
  },
  SendEmailCommand: class {
    constructor(input) {
      this.input = input;
    }
  },
}));

let mockGooglePayload = null;
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockImplementation(() => Promise.resolve({ getPayload: () => mockGooglePayload })),
  })),
}));

const dns = require("dns");
const bcrypt = require("bcryptjs");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const EmailToken = require("../../models/EmailToken");
const IpSighting = require("../../models/IpSighting");
const Transaction = require("../../models/Transaction");
const verification = require("../../utils/verification");
const ipSightings = require("../../utils/ipSightings");
const leaderboard = require("../../utils/leaderboard");
const rain = require("../../utils/rain");
const { TX } = require("../../utils/economy");
const { REFERRER_SIGNUP_BONUS } = require("../../utils/referrals");

// the far-off lock date every suite starts from (setupEnv.js); a test that moves it puts it back
const LOCK_FROM = process.env.VERIFY_REQUIRED_FROM;

let app;
beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
beforeEach(() => {
  mockSent.length = 0;
  process.env.MAIL_ENABLED = "true";
});
afterEach(async () => {
  delete process.env.MAIL_ENABLED;
  process.env.VERIFY_REQUIRED_FROM = LOCK_FROM;
  delete process.env.EMAIL_DNS_CHECK;
  jest.restoreAllMocks();
  ipSightings.forget();
  await clearDb();
});
afterAll(teardownDb);

const makeUser = async (overrides = {}) => {
  const s = uniqueSuffix();
  return User.create({
    username: `u-${s}`,
    email: `u-${s}@mail.com`,
    password: await bcrypt.hash("secret1", 4),
    walletBalance: 1000,
    ...overrides,
  });
};
const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const linkIn = (mail) => mail.Content.Simple.Body.Text.Data.match(/token=([A-Za-z0-9_%-]+)/)[1];
const tokenOf = (mail) => decodeURIComponent(linkIn(mail));
const DAY = 24 * 60 * 60 * 1000;
const enforceFrom = (ms) => {
  process.env.VERIFY_REQUIRED_FROM = new Date(ms).toISOString();
};

describe("verifying by email", () => {
  test("the link verifies the account, once, and the account reports it", async () => {
    const u = await makeUser();
    const sent = await auth(request(app).post("/account/verify-email"), u).send({ lang: "pt" });
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ sent: true, to: u.email });
    expect(mockSent).toHaveLength(1);
    expect(mockSent[0].Destination.ToAddresses).toEqual([u.email]);
    expect(mockSent[0].Content.Simple.Subject.Data).toBe("Verifique sua conta da KaniCasino");
    // only a hash of the token is stored
    const token = tokenOf(mockSent[0]);
    expect(await EmailToken.exists({ tokenHash: token })).toBeNull();

    const done = await request(app).post("/account/verify-email/confirm").send({ token });
    expect(done.status).toBe(200);
    const after = await User.findById(u._id);
    expect(after.emailVerifiedAt).toBeInstanceOf(Date);
    expect(after.verifiedMailbox).toBe(u.email);

    const me = await auth(request(app).get("/users/me"), u);
    expect(me.body.verification).toMatchObject({ verified: true, via: "email", canChangeEmail: true });

    const again = await request(app).post("/account/verify-email/confirm").send({ token });
    expect(again.status).toBe(400);
    expect(again.body.reason).toBe("expired");
  });

  test("a second email inside a minute is refused, and at most five go out a day", async () => {
    const u = await makeUser();
    expect((await auth(request(app).post("/account/verify-email"), u).send({})).status).toBe(200);
    const soon = await auth(request(app).post("/account/verify-email"), u).send({});
    expect(soon.status).toBe(429);
    expect(soon.body.reason).toBe("tooSoon");

    const day = new Date().toISOString().slice(0, 10);
    await User.updateOne({ _id: u._id }, { $set: { verifyMail: { day, sent: verification.DAILY_SENDS, lastAt: new Date(0) } } });
    expect((await auth(request(app).post("/account/verify-email"), u).send({})).status).toBe(429);
    expect(mockSent).toHaveLength(1);
  });

  test("a throwaway inbox cannot verify", async () => {
    const u = await makeUser({ email: `x-${uniqueSuffix()}@abowned.com` });
    const res = await auth(request(app).post("/account/verify-email"), u).send({});
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("disposable");
    expect(mockSent).toHaveLength(0);
  });

  test("one inbox verifies one account, however its address is spelled", async () => {
    await makeUser({ email: "john.doe@gmail.com", emailVerifiedAt: new Date(), verifiedMailbox: "johndoe@gmail.com" });
    const twin = await makeUser({ email: "johndoe+alt@gmail.com" });
    const res = await auth(request(app).post("/account/verify-email"), twin).send({});
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("taken");

    // a google account on the same inbox counts too
    await makeUser({ email: "Jane.Roe@gmail.com", googleId: "g-jane" });
    const other = await makeUser({ email: "janeroe@googlemail.com" });
    expect((await auth(request(app).post("/account/verify-email"), other).send({})).body.reason).toBe("taken");
  });

  test("an address that bounced has to be changed first", async () => {
    const u = await makeUser({ emailSuppressed: true });
    const res = await auth(request(app).post("/account/verify-email"), u).send({});
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("bounced");
  });
});

describe("changing the email", () => {
  test("nothing changes until the new address's link is clicked, then it is verified", async () => {
    const u = await makeUser({ emailSuppressed: true, emailSuppressedReason: "bounce" });
    const next = `new-${uniqueSuffix()}@mail.com`;
    const res = await auth(request(app).put("/account/email"), u).send({ email: next, password: "secret1" });
    expect(res.status).toBe(200);
    expect(mockSent[0].Destination.ToAddresses).toEqual([next]);
    expect((await User.findById(u._id)).email).toBe(u.email);

    await request(app).post("/account/verify-email/confirm").send({ token: tokenOf(mockSent[0]) });
    const after = await User.findById(u._id);
    expect(after.email).toBe(next);
    expect(after.emailVerifiedAt).toBeInstanceOf(Date);
    expect(after.emailSuppressed).toBe(false);
    expect(after.emailSuppressedReason).toBeUndefined();
  });

  test("it needs the password, a free address, and is not for google accounts", async () => {
    const u = await makeUser();
    const other = await makeUser();
    const google = await makeUser({ googleId: "g-1", password: undefined });

    const wrong = await auth(request(app).put("/account/email"), u).send({ email: "a@mail.com", password: "nope" });
    expect(wrong.body.reason).toBe("password");
    const taken = await auth(request(app).put("/account/email"), u).send({ email: other.email.toUpperCase(), password: "secret1" });
    expect(taken.status).toBe(409);
    expect(taken.body.reason).toBe("inUse");
    const g = await auth(request(app).put("/account/email"), google).send({ email: "b@mail.com" });
    expect(g.body.reason).toBe("google");
    expect(mockSent).toHaveLength(0);
  });
});

describe("other ways to be verified", () => {
  test("google sign-in on an existing account verifies it and pays what waited", async () => {
    const referrer = await makeUser({ walletBalance: 0 });
    const u = await makeUser({ referredBy: referrer._id, referralBonusPending: true });
    expect(verification.isVerified(u)).toBe(false);

    mockGooglePayload = { email: u.email, name: u.username, picture: "p.png", sub: `sub-${uniqueSuffix()}` };
    const res = await request(app).post("/users/googlelogin").send({ token: "fake" });
    expect(res.status).toBe(200);

    expect(verification.verifiedVia(await User.findById(u._id))).toBe("google");
    expect((await User.findById(referrer._id)).walletBalance).toBe(REFERRER_SIGNUP_BONUS);
  });

  test("a linked discord account verifies, an email link outranks it in the report", () => {
    expect(verification.verifiedVia({ discordId: "123" })).toBe("discord");
    expect(verification.verifiedVia({ discordId: "123", emailVerifiedAt: new Date() })).toBe("email");
    expect(verification.verifiedVia({ discordId: "" })).toBeNull();
  });
});

describe("signing up with an address that takes no mail", () => {
  test("is refused with the likely typo fixed, while a real domain goes through", async () => {
    process.env.EMAIL_DNS_CHECK = "1";
    jest.spyOn(dns.promises, "resolveMx").mockImplementation(async (domain) => {
      if (domain === "gmail.con") throw Object.assign(new Error("nope"), { code: "ENOTFOUND" });
      return [{ exchange: `mx.${domain}`, priority: 10 }];
    });
    const s = uniqueSuffix();
    const bad = await request(app).post("/users/register").send({ email: `typo${s}@gmail.con`, username: `t${s}`, password: "secret1" });
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ field: "email", reason: "noMailServer", suggestion: `typo${s}@gmail.com` });
    const good = await request(app).post("/users/register").send({ email: `ok${s}@gmail.com`, username: `o${s}`, password: "secret1" });
    expect(good.status).toBe(200);
  });
});

describe("the gates, before and after the lock date", () => {
  test("the market refuses an unverified account only from the lock date", async () => {
    const u = await makeUser({ level: 30 });
    const verified = await makeUser({ level: 30, discordId: `d-${uniqueSuffix()}` });
    const order = (who) => auth(request(app).post("/marketplace/orders"), who).send({ itemId: "nope", price: 10 });

    enforceFrom(Date.now() + DAY);
    expect((await order(u)).body.reason).not.toBe("verify");

    enforceFrom(Date.now() - DAY);
    const locked = await order(u);
    expect(locked.status).toBe(403);
    expect(locked.body.reason).toBe("verify");
    expect((await order(verified)).body.reason).not.toBe("verify");
  });

  test("joining the rain needs a verified account from the lock date", async () => {
    const u = await makeUser({ level: 30 });
    enforceFrom(Date.now() + DAY);
    expect((await rain.join(u._id)).error).toBeUndefined();

    const v = await makeUser({ level: 30 });
    enforceFrom(Date.now() - DAY);
    const res = await rain.join(v._id);
    expect(res.error).toBe("verify");
    await User.updateOne({ _id: v._id }, { $set: { emailVerifiedAt: new Date() } });
    expect((await rain.join(v._id)).error).toBeUndefined();
  });

  test("a board from the lock date ranks and pays verified accounts only; an earlier one keeps its rules", async () => {
    const plain = await makeUser();
    const google = await makeUser({ googleId: `g-${uniqueSuffix()}` });
    const { startsAt, endsAt } = leaderboard.windowFor();
    const mid = new Date(startsAt.getTime() + 60 * 1000);
    for (const [u, amount] of [[plain, 5000], [google, 1000]]) {
      await Transaction.create({ userId: u._id, type: TX.CASE_OPEN, direction: "debit", amount, balanceAfter: 0, meta: {}, createdAt: mid });
    }

    enforceFrom(endsAt.getTime());
    expect((await leaderboard.standings(startsAt, endsAt)).map((r) => String(r._id))).toEqual([String(plain._id), String(google._id)]);

    enforceFrom(startsAt.getTime());
    expect((await leaderboard.standings(startsAt, endsAt)).map((r) => String(r._id))).toEqual([String(google._id)]);
  });
});

describe("hashed addresses", () => {
  test("a login keeps a keyed hash of the address, never the address, for 90 days", async () => {
    const u = await makeUser();
    const res = await request(app).post("/users/login").set("cf-connecting-ip", "203.0.113.7").send({ email: u.email, password: "secret1" });
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    const rows = await IpSighting.find({ userId: u._id }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].ipHash).toBe(ipSightings.hashIp("203.0.113.7"));
    expect(rows[0].ipHash).not.toContain("203");

    const ttl = (await IpSighting.collection.indexes()).find((i) => i.key.lastAt === 1);
    expect(ttl.expireAfterSeconds).toBe(90 * 24 * 60 * 60);
  });
});
