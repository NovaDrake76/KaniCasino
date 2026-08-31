process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const ChatMessage = require("../../models/ChatMessage");
const chat = require("../../utils/chat");

beforeAll(setupDb);
afterEach(async () => {
  await clearDb();
  chat.reset();
});
afterAll(teardownDb);

const makeUser = (over = {}) =>
  User.create({
    username: `chat${uniqueSuffix()}`,
    email: `chat${uniqueSuffix()}@k.co`,
    password: "x",
    level: 10,
    ...over,
  });

describe("sending to the chat", () => {
  it("stores the message and hands back the rendered row", async () => {
    const u = await makeUser();

    const res = await chat.send(u._id, "  first  post  ");

    expect(res.error).toBeUndefined();
    expect(res.message.text).toBe("first post");
    expect(res.message.username).toBe(u.username);
    expect(await ChatMessage.countDocuments({})).toBe(1);
  });

  it("writes the author onto the row, so reading history costs no user reads", async () => {
    const u = await makeUser({ level: 42, profilePicture: "pic.png" });

    await chat.send(u._id, "hello");

    const row = await ChatMessage.findOne({}).lean();
    expect(row.username).toBe(u.username);
    expect(row.level).toBe(42);
    expect(row.profilePicture).toBe("pic.png");
  });

  it("turns away a level too low to have cost anything to make", async () => {
    const u = await makeUser({ level: 0 });

    const res = await chat.send(u._id, "buy my stuff");

    expect(res.error).toBe("level");
    expect(await ChatMessage.countDocuments({})).toBe(0);
  });

  it("holds a player to one message per window", async () => {
    const u = await makeUser();

    expect((await chat.send(u._id, "one")).error).toBeUndefined();
    expect((await chat.send(u._id, "two")).error).toBe("slowDown");
    expect(await ChatMessage.countDocuments({})).toBe(1);
  });

  it("does not spend the window on a message it refused", async () => {
    // otherwise one typo costs the player their next few seconds for nothing
    const u = await makeUser();

    expect((await chat.send(u._id, "look at http://spam.com")).error).toBe("noLinks");
    expect((await chat.send(u._id, "sorry, hello")).error).toBeUndefined();
  });

  it("keeps a banned name off every page", async () => {
    const u = await makeUser({ disabled: true });

    expect((await chat.send(u._id, "hello")).error).toBe("banned");
  });

  it("refuses an anonymous socket", async () => {
    expect((await chat.send(null, "hello")).error).toBe("auth");
  });
});

describe("reading the chat back", () => {
  it("returns the history oldest first, so it renders top to bottom", async () => {
    const u = await makeUser();
    for (const text of ["one", "two", "three"]) {
      chat.reset();
      await chat.send(u._id, text);
    }

    const rows = await chat.recent();

    expect(rows.map((r) => r.text)).toEqual(["one", "two", "three"]);
  });

  it("hands back at most the keep limit", async () => {
    const u = await makeUser();
    for (let i = 0; i < chat.KEEP + 5; i++) {
      chat.reset();
      await chat.send(u._id, `m${i}`);
    }

    expect((await chat.recent()).length).toBe(chat.KEEP);
  });

  it("drops a message an admin took down", async () => {
    const u = await makeUser();
    const { message } = await chat.send(u._id, "regrettable");

    await chat.remove(message.id);

    expect(await chat.recent()).toHaveLength(0);
  });
});
