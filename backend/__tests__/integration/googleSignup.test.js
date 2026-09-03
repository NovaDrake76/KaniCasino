process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const Transaction = require("../../models/Transaction");
const signup = require("../../utils/signup");
const { TX } = require("../../utils/economy");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

const GOOGLE = {
  sub: "108154321987654321",
  email: "player@gmail.com",
  name: "Nova Drake",
  picture: "https://lh3.googleusercontent.com/a/face.jpg",
};

const complete = (body) => request(app).post("/users/google/complete").send(body);
const ticketFor = (over = {}) => signup.issueTicket({ ...GOOGLE, ...over });

describe("finishing a google signup", () => {
  it("creates the account with the name the player chose, not google's", async () => {
    const res = await complete({ ticket: ticketFor(), username: "Sakuya", useGooglePicture: false });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    const user = await User.findOne({ email: GOOGLE.email });
    expect(user.username).toBe("Sakuya");
    expect(user.username).not.toBe(GOOGLE.name);
  });

  it("leaves google's face off the site unless it is asked for", async () => {
    // the whole reason this step exists: a player wanted to sign in with google without
    // their real photo and name on a public leaderboard
    await complete({ ticket: ticketFor(), username: "Anonymous Kani", useGooglePicture: false });

    const user = await User.findOne({ email: GOOGLE.email });
    expect(user.profilePicture).not.toBe(GOOGLE.picture);
    // basePicture follows it, or the profile page offers to reset to a picture never chosen
    expect(user.basePicture).toBe(user.profilePicture);
  });

  it("takes google's picture when it is asked for", async () => {
    await complete({ ticket: ticketFor(), username: "Sakuya", useGooglePicture: true });

    const user = await User.findOne({ email: GOOGLE.email });
    expect(user.profilePicture).toBe(GOOGLE.picture);
    expect(user.basePicture).toBe(GOOGLE.picture);
  });

  it("credits the opening balance once, against the ledger", async () => {
    await complete({ ticket: ticketFor(), username: "Sakuya", useGooglePicture: false });

    const user = await User.findOne({ email: GOOGLE.email });
    const rows = await Transaction.find({ userId: user._id, type: TX.SIGNUP });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(user.walletBalance);
    expect(rows[0].meta.source).toBe("google");
  });

  it("links the google account, so the next sign-in is a login", async () => {
    await complete({ ticket: ticketFor(), username: "Sakuya", useGooglePicture: false });

    const user = await User.findOne({ email: GOOGLE.email });
    expect(user.googleId).toBe(GOOGLE.sub);
  });
});

describe("what the finishing route refuses", () => {
  it("refuses a ticket it did not sign", async () => {
    // or anybody could post an email at this route and be handed an account for it
    const forged = jwt.sign({ ...GOOGLE, use: "google-signup" }, `${process.env.JWT_SECRET}-wrong`);

    const res = await complete({ ticket: forged, username: "Sakuya" });

    expect(res.status).toBe(400);
    expect(await User.countDocuments({})).toBe(0);
  });

  it("refuses a token minted for something else", async () => {
    const wrongUse = jwt.sign({ ...GOOGLE, use: "discord-oauth" }, process.env.JWT_SECRET);

    expect((await complete({ ticket: wrongUse, username: "Sakuya" })).status).toBe(400);
  });

  it("refuses an expired ticket", async () => {
    const stale = jwt.sign({ ...GOOGLE, use: "google-signup" }, process.env.JWT_SECRET, { expiresIn: "-1s" });

    expect((await complete({ ticket: stale, username: "Sakuya" })).status).toBe(400);
  });

  it("refuses a missing ticket rather than creating an account from nothing", async () => {
    expect((await complete({ username: "Sakuya" })).status).toBe(400);
    expect(await User.countDocuments({})).toBe(0);
  });

  it("refuses a nickname that is too short, too long, or shaped wrong", async () => {
    for (const [name, reason] of [["a", "tooShort"], ["a".repeat(31), "tooLong"], ["nova<script>", "badCharacters"]]) {
      const res = await complete({ ticket: ticketFor(), username: name });
      expect(res.status).toBe(400);
      expect(res.body.reason).toBe(reason);
    }
    expect(await User.countDocuments({})).toBe(0);
  });

  it("refuses a slur, however it is spelt", async () => {
    const res = await complete({ ticket: ticketFor(), username: "n1gg3r" });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("notAllowed");
  });

  it("refuses a nickname somebody already has, in any casing", async () => {
    await User.create({ username: "Sakuya", slug: "sakuya", email: `a${uniqueSuffix()}@k.co`, password: "x" });

    const res = await complete({ ticket: ticketFor(), username: "sakuya" });

    expect(res.status).toBe(400);
    expect(res.body.reason).toBe("taken");
  });

  it("logs in rather than failing when the email was claimed while the form was open", async () => {
    const existing = await User.create({
      username: "Earlier", slug: "earlier", email: GOOGLE.email, password: "x",
    });

    const res = await complete({ ticket: ticketFor(), username: "Sakuya" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET).userId).toBe(String(existing._id));
    expect(await User.countDocuments({})).toBe(1);
  });

  it("keeps a disabled account out", async () => {
    await User.create({
      username: "Banned", slug: "banned", email: GOOGLE.email, password: "x", disabled: true,
    });

    expect((await complete({ ticket: ticketFor(), username: "Sakuya" })).status).toBe(403);
  });
});

describe("the nickname the step suggests", () => {
  it("offers the google name when it is usable and free", async () => {
    expect(await signup.suggestName("Nova Drake", GOOGLE.sub)).toBe("Nova Drake");
  });

  it("offers a variant when it is taken, rather than a name that cannot be used", async () => {
    await User.create({ username: "Nova Drake", slug: "nova-drake", email: `b${uniqueSuffix()}@k.co`, password: "x" });

    const suggested = await signup.suggestName("Nova Drake", GOOGLE.sub);

    expect(suggested).not.toBe("Nova Drake");
    expect(signup.nameProblem(suggested)).toBeNull();
    expect(await signup.nameTaken(suggested)).toBeFalsy();
  });

  it("never offers a google name that is itself a slur", async () => {
    const suggested = await signup.suggestName("nigger", GOOGLE.sub);
    expect(signup.nameProblem(suggested)).toBeNull();
  });
});
