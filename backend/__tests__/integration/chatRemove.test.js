process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const ChatMessage = require("../../models/ChatMessage");
const chat = require("../../utils/chat");

let app;
beforeAll(async () => { await setupDb(); app = makeApp(); });
afterEach(async () => {
  await clearDb();
  chat.reset();
});
afterAll(teardownDb);

const makeUser = (fields = {}) => {
  const s = uniqueSuffix();
  return User.create({ username: `c-${s}`, email: `c-${s}@e.com`, password: "x", level: 10, ...fields });
};

const said = async () => {
  const author = await makeUser();
  return (await chat.send(author._id, "take this down")).message;
};

const remove = (id, user) => {
  const call = request(app).delete(`/admin/chat/${id}`);
  return user ? call.set({ Authorization: `Bearer ${tokenFor(user)}` }) : call;
};

describe("taking a chat message down", () => {
  it("lets an admin delete a message for everyone", async () => {
    const message = await said();

    const res = await remove(message.id, await makeUser({ isAdmin: true }));

    expect(res.status).toBe(200);
    expect(await ChatMessage.countDocuments({})).toBe(0);
  });

  it("refuses a player who is not an admin, and the message stays", async () => {
    const message = await said();

    const res = await remove(message.id, await makeUser());

    expect(res.status).toBe(403);
    expect(await ChatMessage.countDocuments({})).toBe(1);
  });

  it("refuses a request with no session", async () => {
    const message = await said();

    expect((await remove(message.id)).status).toBe(401);
    expect(await ChatMessage.countDocuments({})).toBe(1);
  });

  it("says so when the message is already gone", async () => {
    const message = await said();
    const admin = await makeUser({ isAdmin: true });
    await remove(message.id, admin);

    expect((await remove(message.id, admin)).status).toBe(404);
  });
});
