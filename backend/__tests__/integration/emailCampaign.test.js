process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.SITE_URL = "https://site.example.com";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const EmailSend = require("../../models/EmailSend");
const policyUpdate = require("../../utils/emails/policyUpdate");

beforeAll(setupDb);
afterEach(clearDb);
afterAll(teardownDb);

describe("the policy update template", () => {
  it("greets the person by name in both the html and the plain text", () => {
    const { html, text } = policyUpdate.build("Nova Drake993");
    expect(html).toContain("Hi, Nova Drake993!");
    expect(text).toContain("Hi, Nova Drake993!");
  });

  it("links to the policy on the site, not to the api", () => {
    const { html, text } = policyUpdate.build("x");
    expect(html).toContain("https://site.example.com/privacy-policy");
    expect(text).toContain("https://site.example.com/privacy-policy");
  });

  it("always ships a text part, since a html-only bulk send looks like spam", () => {
    const { subject, text } = policyUpdate.build("x");
    expect(subject).toBeTruthy();
    expect(text.length).toBeGreaterThan(200);
  });
});

describe("campaign bookkeeping", () => {
  const makeUser = () => {
    const s = uniqueSuffix();
    return User.create({ username: `user-${s}`, email: `user-${s}@example.com`, password: "x" });
  };

  it("refuses a second row for the same person and campaign, so a re-run cannot double send", async () => {
    const u = await makeUser();
    await EmailSend.syncIndexes();

    await EmailSend.create({ campaign: "policyUpdate", user: u._id, email: u.email, status: "sent" });
    await expect(
      EmailSend.create({ campaign: "policyUpdate", user: u._id, email: u.email, status: "sent" })
    ).rejects.toThrow();

    expect(await EmailSend.countDocuments({ user: u._id })).toBe(1);
  });

  it("lets the same person receive a different campaign", async () => {
    const u = await makeUser();
    await EmailSend.syncIndexes();

    await EmailSend.create({ campaign: "policyUpdate", user: u._id, email: u.email, status: "sent" });
    await EmailSend.create({ campaign: "somethingElse", user: u._id, email: u.email, status: "sent" });

    expect(await EmailSend.countDocuments({ user: u._id })).toBe(2);
  });

  it("records why a send did not happen, so skipped is not confused with failed", async () => {
    const u = await makeUser();
    await EmailSend.create({
      campaign: "policyUpdate",
      user: u._id,
      email: u.email,
      status: "skipped",
      detail: "suppressed",
    });

    const row = await EmailSend.findOne({ user: u._id });
    expect(row.status).toBe("skipped");
    expect(row.detail).toBe("suppressed");
  });
});

// the audience query is the thing that decides who gets mailed, so it is worth pinning
describe("who the campaign would target", () => {
  const audienceFilter = {
    email: { $exists: true, $nin: [null, ""] },
    emailSuppressed: { $ne: true },
    ...policyUpdate.audience,
  };

  const googleUser = (s) => User.create({ username: `g-${s}`, email: `g-${s}@example.com` });
  const registered = (s) =>
    User.create({ username: `r-${s}`, email: `r-${s}@example.com`, password: "hashed" });

  it("skips suppressed addresses and anyone without an email", async () => {
    const s = uniqueSuffix();
    const ok = await googleUser(s);
    await User.create({ username: `sup-${s}`, email: `sup-${s}@example.com`, emailSuppressed: true });
    // the schema requires email now, but older docs predate that, which is what the guard is for
    await User.collection.insertOne({ username: `none-${s}` });
    await User.collection.insertOne({ username: `blank-${s}`, email: "" });

    const found = await User.find(audienceFilter).select("_id");

    expect(found.map((u) => String(u._id))).toEqual([String(ok._id)]);
  });

  it("includes people who never opted in to marketing, because this is service mail", async () => {
    await googleUser(uniqueSuffix());

    const found = await User.find(audienceFilter);

    expect(found).toHaveLength(1);
    expect(found[0].marketingOptIn).toBe(false);
  });

  it("leaves out accounts registered with a password, whose address nobody ever confirmed", async () => {
    const s = uniqueSuffix();
    const g = await googleUser(s);
    await registered(s);

    const found = await User.find(audienceFilter).select("_id");

    expect(found.map((u) => String(u._id))).toEqual([String(g._id)]);
  });

  it("counts an account carrying a googleId even if it somehow also has a password", async () => {
    const s = uniqueSuffix();
    await User.create({
      username: `both-${s}`,
      email: `both-${s}@example.com`,
      password: "hashed",
      googleId: "1234567890",
    });

    expect(await User.countDocuments(audienceFilter)).toBe(1);
  });
});
