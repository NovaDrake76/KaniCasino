process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const http = require("http");
const { Server } = require("socket.io");
const { io: Client } = require("socket.io-client");
const jwt = require("jsonwebtoken");

const { setupDb, clearDb, teardownDb } = require("./db");
const { uniqueSuffix } = require("./helpers");
const User = require("../../models/User");
const Item = require("../../models/Item");
const Case = require("../../models/Case");
const Battle = require("../../models/Battle");
const caseBattle = require("../../games/caseBattle");

let httpServer, io, port;

beforeAll(async () => {
  await setupDb();
  httpServer = http.createServer();
  io = new Server(httpServer);
  // same optional-auth handshake as index.js
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (token) socket.userId = jwt.verify(token, process.env.JWT_SECRET).userId;
    } catch (e) {
      // anonymous
    }
    next();
  });
  caseBattle(io);
  await new Promise((r) => httpServer.listen(0, r));
  port = httpServer.address().port;
});

afterEach(clearDb);

afterAll(async () => {
  await new Promise((r) => io.close(r));
  await teardownDb();
});

const tokenFor = (user) => jwt.sign({ userId: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: "1h" });

const connect = (token) =>
  new Promise((resolve, reject) => {
    const c = Client(`http://localhost:${port}`, {
      auth: (cb) => cb({ token: token || "" }),
      forceNew: true,
      transports: ["websocket"],
    });
    c.on("connect", () => resolve(c));
    c.on("connect_error", reject);
  });

// emit-with-ack with a hard timeout, so a non-acking handler fails fast instead of hanging
const emitAck = (c, event, ...args) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ack never fired for ${event}`)), 4000);
    c.emit(event, ...args, (res) => {
      clearTimeout(t);
      resolve(res);
    });
  });

async function makeUser(overrides = {}) {
  const s = uniqueSuffix();
  return User.create({ username: `u-${s}`, email: `u-${s}@e.com`, password: "x", walletBalance: 1000, level: 5, ...overrides });
}
async function makeCase(price = 50) {
  const item = await Item.create({ name: "BI", image: "b.png", rarity: "3", baseValue: 100 });
  return Case.create({ title: "BC", image: "c.png", price, items: [item._id] });
}

describe("case battle socket layer", () => {
  test("battle:create acks with an id for an authenticated socket", async () => {
    const u = await makeUser();
    const c = await makeCase(50);
    const sock = await connect(tokenFor(u));
    const res = await emitAck(sock, "battle:create", { caseIds: [c._id.toString()], mode: "1v1", bakaMode: false });
    expect(res).toBeTruthy();
    expect(res.error).toBeUndefined();
    expect(res.id).toBeTruthy();
    sock.close();
  });

  test("battle:create acks with an error (never hangs) when unauthenticated", async () => {
    const c = await makeCase(50);
    const sock = await connect("");
    const res = await emitAck(sock, "battle:create", { caseIds: [c._id.toString()], mode: "1v1", bakaMode: false });
    expect(res.error).toBe("Not authenticated");
    sock.close();
  });

  test("a second human can join a created battle", async () => {
    const host = await makeUser();
    const c = await makeCase(50);
    const hostSock = await connect(tokenFor(host));
    const created = await emitAck(hostSock, "battle:create", { caseIds: [c._id.toString()], mode: "1v1", bakaMode: false });

    const joiner = await makeUser();
    const joinSock = await connect(tokenFor(joiner));
    const joined = await emitAck(joinSock, "battle:join", created.id);
    expect(joined.error).toBeUndefined();
    expect(joined.id).toBeTruthy();

    hostSock.close();
    joinSock.close();
  });

  test("host fills with a bot and starts; battle reveals and finishes", async () => {
    const host = await makeUser({ walletBalance: 1000 });
    const c = await makeCase(50);
    const hostSock = await connect(tokenFor(host));
    const created = await emitAck(hostSock, "battle:create", { caseIds: [c._id.toString()], mode: "1v1", bakaMode: false });

    const bot = await emitAck(hostSock, "battle:addBot", created.id);
    expect(bot.ok).toBe(true);

    const finishedP = new Promise((resolve) => hostSock.once("battle:finished", resolve));
    const started = await emitAck(hostSock, "battle:start", created.id);
    expect(started.ok).toBe(true);

    const fin = await finishedP;
    expect(fin.status).toBe("finished");
    expect(fin.players.every((p) => p.items.length === 1)).toBe(true); // one case opened
    hostSock.close();
  });

  test("concurrent battle:start charges the host exactly once (no double-start)", async () => {
    const host = await makeUser({ walletBalance: 1000 });
    const c = await makeCase(50);
    const hostSock = await connect(tokenFor(host));
    const created = await emitAck(hostSock, "battle:create", { caseIds: [c._id.toString()], mode: "1v1", bakaMode: false });
    await emitAck(hostSock, "battle:addBot", created.id);

    const finishedP = new Promise((resolve) => hostSock.once("battle:finished", resolve));
    // fire two starts in the same tick; only one may charge/preroll/reveal
    const results = await Promise.all([
      emitAck(hostSock, "battle:start", created.id).catch((e) => ({ error: String(e) })),
      emitAck(hostSock, "battle:start", created.id).catch((e) => ({ error: String(e) })),
    ]);
    expect(results.filter((r) => r && r.ok).length).toBe(1);

    await finishedP;
    const after = await User.findById(host._id).select("walletBalance");
    expect(after.walletBalance).toBe(950); // 1000 - 50 entry, charged once
    hostSock.close();
  });

  test("concurrent battle:join from one account claims a single seat (no duplicate)", async () => {
    const host = await makeUser();
    const c = await makeCase(50);
    const hostSock = await connect(tokenFor(host));
    const created = await emitAck(hostSock, "battle:create", { caseIds: [c._id.toString()], mode: "1v1v1v1", bakaMode: false });

    const attacker = await makeUser({ walletBalance: 1000 });
    const aSock = await connect(tokenFor(attacker));
    // two joins in the same tick must not seat the same user twice
    await Promise.all([
      emitAck(aSock, "battle:join", created.id).catch((e) => ({ error: String(e) })),
      emitAck(aSock, "battle:join", created.id).catch((e) => ({ error: String(e) })),
    ]);

    const b = await Battle.findById(created.id);
    const seats = b.players.filter((p) => p.userId && p.userId.toString() === attacker._id.toString());
    expect(seats.length).toBe(1);
    expect(b.players.length).toBe(2); // host + attacker once
    hostSock.close();
    aSock.close();
  });
});
