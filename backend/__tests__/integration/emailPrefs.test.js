process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);

async function makeUser(overrides = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    ...overrides,
  });
}

describe("marketing consent", () => {
  it("is off for a new account, and nobody is opted in by default", async () => {
    const u = await makeUser();
    expect(u.marketingOptIn).toBe(false);
    expect(u.unsubscribeToken).toBeTruthy();
  });

  it("the owner can turn it on and off, and the time is recorded", async () => {
    const u = await makeUser();

    const on = await auth(request(app).put("/email/preferences"), u).send({ marketingOptIn: true });
    expect(on.body.marketingOptIn).toBe(true);
    expect((await User.findById(u._id)).marketingOptInAt).toBeTruthy();

    const off = await auth(request(app).put("/email/preferences"), u).send({ marketingOptIn: false });
    expect(off.body.marketingOptIn).toBe(false);
  });

  it("only accepts a real boolean, so a stray value cannot opt someone in", async () => {
    const u = await makeUser();
    await auth(request(app).put("/email/preferences"), u).send({ marketingOptIn: "yes" });
    expect((await User.findById(u._id)).marketingOptIn).toBe(false);
  });

  it("needs a login to read or change", async () => {
    expect((await request(app).get("/email/preferences")).status).toBe(401);
    expect((await request(app).put("/email/preferences").send({ marketingOptIn: true })).status).toBe(401);
  });
});

describe("one-click unsubscribe", () => {
  it("turns marketing off with only the token, no session", async () => {
    const u = await makeUser({ marketingOptIn: true });

    const res = await request(app).post(`/email/unsubscribe?u=${u._id}&t=${u.unsubscribeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.unsubscribed).toBe(true);
    expect((await User.findById(u._id)).marketingOptIn).toBe(false);
  });

  it("refuses a wrong token, so the link cannot be guessed", async () => {
    const u = await makeUser({ marketingOptIn: true });

    const res = await request(app).post(`/email/unsubscribe?u=${u._id}&t=not-the-token`);

    expect(res.status).toBe(404);
    expect((await User.findById(u._id)).marketingOptIn).toBe(true);
  });

  it("answers GET too, since some clients prefetch the link", async () => {
    const u = await makeUser({ marketingOptIn: true });
    const res = await request(app).get(`/email/unsubscribe?u=${u._id}&t=${u.unsubscribeToken}`);
    expect(res.body.unsubscribed).toBe(true);
  });
});

describe("bounces and complaints", () => {
  const snsEvent = (message) =>
    request(app)
      .post("/email/ses-events")
      .set("Content-Type", "text/plain")
      .send(JSON.stringify({ Type: "Notification", Message: JSON.stringify(message) }));

  it("suppresses an address that hard-bounces", async () => {
    const u = await makeUser();

    await snsEvent({
      notificationType: "Bounce",
      bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: u.email }] },
    });

    const after = await User.findById(u._id);
    expect(after.emailSuppressed).toBe(true);
    expect(after.emailSuppressedReason).toBe("bounce");
  });

  it("leaves a soft bounce alone", async () => {
    const u = await makeUser();

    await snsEvent({
      notificationType: "Bounce",
      bounce: { bounceType: "Transient", bouncedRecipients: [{ emailAddress: u.email }] },
    });

    expect((await User.findById(u._id)).emailSuppressed).toBe(false);
  });

  it("suppresses an address that reports spam", async () => {
    const u = await makeUser({ marketingOptIn: true });

    await snsEvent({
      notificationType: "Complaint",
      complaint: { complainedRecipients: [{ emailAddress: u.email }] },
    });

    const after = await User.findById(u._id);
    expect(after.emailSuppressed).toBe(true);
    expect(after.emailSuppressedReason).toBe("complaint");
  });

  it("swallows an unparseable payload rather than making SNS retry forever", async () => {
    const res = await request(app)
      .post("/email/ses-events")
      .set("Content-Type", "text/plain")
      .send("not json at all");
    expect(res.status).toBe(200);
  });
});

describe("the mailer refuses to send where it should not", () => {
  const { sendMail } = require("../../utils/mailer");

  beforeEach(() => {
    process.env.MAIL_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.MAIL_ENABLED;
  });

  it("does nothing at all when email is switched off", async () => {
    delete process.env.MAIL_ENABLED;
    const u = await makeUser();
    expect(await sendMail({ to: u.email, subject: "s", html: "h", text: "t" })).toEqual({
      skipped: "disabled",
    });
  });

  it("refuses marketing to someone who never opted in", async () => {
    const u = await makeUser();
    const res = await sendMail({ to: u.email, subject: "s", html: "h", text: "t", kind: "marketing" });
    expect(res).toEqual({ skipped: "no consent" });
  });

  it("refuses anything to a suppressed address, service mail included", async () => {
    const u = await makeUser({ emailSuppressed: true, marketingOptIn: true });
    expect(await sendMail({ to: u.email, subject: "s", html: "h", text: "t" })).toEqual({
      skipped: "suppressed",
    });
  });

  it("refuses an address that belongs to nobody", async () => {
    expect(await sendMail({ to: "stranger@example.com", subject: "s", html: "h", text: "t" })).toEqual({
      skipped: "unknown recipient",
    });
  });
});
