process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.DISCORD_BOT_SECRET = "bot-secret-for-tests";
process.env.SITE_URL = "https://kanicasino.com";
process.env.DISCORD_GUILD_ID = "907336089797267496";

const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, tokenFor, uniqueSuffix } = require("./helpers");

const Case = require("../../models/Case");
const User = require("../../models/User");
const DiscordLink = require("../../models/DiscordLink");
const FanBoard = require("../../models/FanBoard");

const SECRET = process.env.DISCORD_BOT_SECRET;
const DISCORD_EPOCH = 1420070400000;
const GUILD = "907336089797267496";
const OTHER_GUILD = "111111111111111111";

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
afterEach(clearDb);
afterAll(teardownDb);

// discord ids carry their own creation time, which is what the age check reads
const snowflakeFor = (date) => String(BigInt(date.getTime() - DISCORD_EPOCH) << 22n);
const daysAgo = (days) => new Date(Date.now() - days * 86400000);
const oldEnough = () => snowflakeFor(daysAgo(400));

async function makeUser(overrides = {}) {
  const s = uniqueSuffix();
  return User.create({
    username: `user-${s}`,
    email: `user-${s}@example.com`,
    password: "x",
    ...overrides,
  });
}

const bot = (req) => req.set("x-bot-secret", SECRET);
const auth = (req, user) => req.set("Authorization", `Bearer ${tokenFor(user)}`);
const startLink = (discordId) =>
  bot(request(app).post("/discord/link/start")).send({ discordId, discordName: "someone" });
const completeLink = (user, code) =>
  auth(request(app).post("/discord/link/complete"), user).send({ code });

// the whole flow, since most tests need an account already linked
async function linkUser(user, discordId, guilds = []) {
  const started = await startLink(discordId);
  await completeLink(user, started.body.code);
  if (guilds.length) await User.updateOne({ _id: user._id }, { $set: { discordGuilds: guilds } });
  return started.body.code;
}

describe("discord bot routes", () => {
  describe("the bot secret", () => {
    it("refuses a caller with no secret", async () => {
      const res = await request(app).post("/discord/link/start").send({ discordId: oldEnough() });
      expect(res.status).toBe(403);
    });

    it("refuses a caller with the wrong secret", async () => {
      const res = await request(app)
        .post("/discord/link/start")
        .set("x-bot-secret", "not-the-secret-at-all")
        .send({ discordId: oldEnough() });
      expect(res.status).toBe(403);
    });

    // the site api key ships in the frontend bundle, so anyone could mint a link code
    // for someone else's discord id if that were the only gate
    it("guards showcase, topfan and the leaderboard too", async () => {
      const paths = [
        `/discord/showcase/${oldEnough()}`,
        `/discord/topfan/Hoshino?guild=${GUILD}`,
        `/discord/leaderboard?guild=${GUILD}`,
      ];
      for (const path of paths) {
        expect((await request(app).get(path)).status).toBe(403);
      }
    });
  });

  describe("linking", () => {
    it("turns a code into a link once the site session claims it", async () => {
      const user = await makeUser();
      const discordId = oldEnough();

      const started = await startLink(discordId);
      expect(started.status).toBe(200);
      expect(started.body.code).toMatch(/^[A-Z2-9]{8}$/);
      expect(started.body.url).toContain(started.body.code);

      const done = await completeLink(user, started.body.code);
      expect(done.status).toBe(200);
      expect(done.body.username).toBe(user.username);

      const stored = await User.findById(user._id).select("discordId").lean();
      expect(stored.discordId).toBe(discordId);
      // the code is spent, not left lying around
      expect(await DiscordLink.countDocuments({ code: started.body.code })).toBe(0);
    });

    it("turns away a discord account created in the last 30 days", async () => {
      const res = await startLink(snowflakeFor(daysAgo(3)));
      expect(res.status).toBe(403);
      expect(await DiscordLink.countDocuments()).toBe(0);
    });

    it("says who holds a discord id rather than minting another code", async () => {
      const user = await makeUser();
      const discordId = oldEnough();
      await linkUser(user, discordId);

      const again = await startLink(discordId);
      expect(again.body.alreadyLinked).toBe(true);
      expect(again.body.username).toBe(user.username);
      expect(again.body.code).toBeUndefined();
    });

    it("will not let a second account claim a discord id already linked", async () => {
      const first = await makeUser();
      const second = await makeUser();
      const discordId = oldEnough();

      const started = await startLink(discordId);
      await completeLink(first, started.body.code);

      // a code that was captured before it was redeemed is worthless afterwards
      const res = await completeLink(second, started.body.code);
      expect(res.status).toBe(404);
      const stored = await User.findById(second._id).select("discordId").lean();
      expect(stored.discordId).toBeUndefined();
    });

    it("will not let one account link twice", async () => {
      const user = await makeUser();
      await linkUser(user, oldEnough());

      const started = await startLink(snowflakeFor(daysAgo(500)));
      const res = await completeLink(user, started.body.code);
      expect(res.status).toBe(409);
    });

    it("refuses an expired code", async () => {
      const user = await makeUser();
      const started = await startLink(oldEnough());
      await DiscordLink.updateOne({ code: started.body.code }, { $set: { expiresAt: daysAgo(1) } });

      const res = await completeLink(user, started.body.code);
      expect(res.status).toBe(404);
    });

    it("needs a session: a code alone links nothing", async () => {
      const started = await startLink(oldEnough());
      const res = await request(app).post("/discord/link/complete").send({ code: started.body.code });
      expect(res.status).toBe(401);
    });

    it("unlinks, and leaves the discord id free to link again", async () => {
      const user = await makeUser();
      const discordId = oldEnough();
      await linkUser(user, discordId, [GUILD]);

      expect((await auth(request(app).delete("/discord/link"), user)).status).toBe(200);
      const stored = await User.findById(user._id).select("discordId discordGuilds").lean();
      expect(stored.discordId).toBeUndefined();
      expect(stored.discordGuilds).toBeUndefined();

      const other = await makeUser();
      const started = await startLink(discordId);
      expect((await completeLink(other, started.body.code)).status).toBe(200);
    });
  });

  describe("showcase", () => {
    it("hands back the card, and never the inventory", async () => {
      const user = await makeUser({
        level: 12,
        fixedItem: { name: "Hoshino", variant: "Swimsuit", rarity: "5" },
        fanRank: { name: "Hoshino", count: 9, rank: 1, fans: 4, second: 5 },
        collectionRank: { distinct: 30, total: 210, rank: 2 },
        inventory: [{ name: "Hoshino", rarity: "5" }],
      });
      const discordId = oldEnough();
      await linkUser(user, discordId);

      const res = await bot(request(app).get(`/discord/showcase/${discordId}`));
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(user.username);
      expect(res.body.pinned).toMatchObject({ name: "Hoshino", variant: "Swimsuit" });
      expect(res.body.fanRank).toMatchObject({ rank: 1, count: 9 });
      expect(res.body.collection).toMatchObject({ distinct: 30 });
      expect(res.body.inventory).toBeUndefined();
    });

    it("404s for a discord user with no account", async () => {
      const res = await bot(request(app).get(`/discord/showcase/${oldEnough()}`));
      expect(res.status).toBe(404);
    });

    it("hides a disabled account", async () => {
      const user = await makeUser();
      const discordId = oldEnough();
      await linkUser(user, discordId);
      await User.updateOne({ _id: user._id }, { $set: { disabled: true } });

      expect((await bot(request(app).get(`/discord/showcase/${discordId}`))).status).toBe(404);
    });
  });

  describe("server boards", () => {
    async function seedBoard(rows) {
      await FanBoard.create({
        name: "Hoshino",
        image: "hoshino.webp",
        rarity: "5",
        fanCount: rows.length,
        topCount: rows.length ? rows[0].count : 0,
        top: rows[0] || null,
        ranks: rows,
      });
    }

    it("shows only the players who use the bot in this server", async () => {
      const here = await makeUser({ level: 5 });
      const elsewhere = await makeUser({ level: 9 });
      await linkUser(here, oldEnough(), [GUILD]);
      await linkUser(elsewhere, snowflakeFor(daysAgo(500)), [OTHER_GUILD]);

      await seedBoard([
        { userId: elsewhere._id, username: elsewhere.username, count: 40 },
        { userId: here._id, username: here.username, count: 6 },
      ]);

      const res = await bot(request(app).get(`/discord/topfan/Hoshino?guild=${GUILD}`));
      expect(res.status).toBe(200);
      expect(res.body.ranks.map((row) => row.username)).toEqual([here.username]);
      // the worldwide leader still shows, because the gap is the reason to keep playing
      expect(res.body.global).toBe(40);
    });

    it("finds a character whatever the caller capitalised", async () => {
      await seedBoard([]);
      const res = await bot(request(app).get(`/discord/topfan/hOsHiNo?guild=${GUILD}`));
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Hoshino");
    });

    it("404s on a character that has no board", async () => {
      const res = await bot(request(app).get(`/discord/topfan/Nobody?guild=${GUILD}`));
      expect(res.status).toBe(404);
    });

    it("ranks this server's players by level, and leaves other servers out", async () => {
      const top = await makeUser({ level: 30 });
      const low = await makeUser({ level: 2 });
      const elsewhere = await makeUser({ level: 99 });
      await linkUser(top, oldEnough(), [GUILD]);
      await linkUser(low, snowflakeFor(daysAgo(500)), [GUILD]);
      await linkUser(elsewhere, snowflakeFor(daysAgo(600)), [OTHER_GUILD]);

      const res = await bot(request(app).get(`/discord/leaderboard?guild=${GUILD}`));
      expect(res.status).toBe(200);
      expect(res.body.players.map((row) => row.username)).toEqual([top.username, low.username]);
    });

    it("needs a guild", async () => {
      expect((await bot(request(app).get("/discord/leaderboard"))).status).toBe(400);
      expect((await bot(request(app).get("/discord/topfan/Hoshino"))).status).toBe(400);
    });
  });

  describe("being seen in a server", () => {
    it("records the server once, however many commands are run", async () => {
      const user = await makeUser();
      const discordId = oldEnough();
      await linkUser(user, discordId);

      for (let i = 0; i < 3; i += 1) {
        await bot(request(app).post("/discord/seen")).send({ discordId, guildId: GUILD });
      }
      const stored = await User.findById(user._id).select("discordGuilds").lean();
      expect(stored.discordGuilds).toEqual([GUILD]);
    });

    it("caps the array, so it cannot grow without bound", async () => {
      const user = await makeUser();
      const discordId = oldEnough();
      await linkUser(user, discordId);

      for (let i = 0; i < 30; i += 1) {
        await bot(request(app).post("/discord/seen")).send({ discordId, guildId: `guild-${i}` });
      }
      const stored = await User.findById(user._id).select("discordGuilds").lean();
      expect(stored.discordGuilds).toHaveLength(25);
      // the cap keeps the most recent, so a player who moved on still shows where they play
      expect(stored.discordGuilds).toContain("guild-29");
      expect(stored.discordGuilds).not.toContain("guild-0");
    });
  });
});

// linking from the site instead of from the bot. discord is the only thing that can say
// which discord account a browser belongs to, so the player is sent there and back.
describe("linking from the site", () => {
  const jwt = require("jsonwebtoken");
  const CLIENT = "1541676225133809714";
  let realFetch;

  beforeAll(() => {
    process.env.DISCORD_CLIENT_ID = CLIENT;
    process.env.DISCORD_CLIENT_SECRET = "test-client-secret";
    process.env.DISCORD_REDIRECT_URI = "https://api.example.test/discord/oauth/callback";
    realFetch = global.fetch;
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  // discord answers twice: once to trade the code for a token, once for the account
  const discordAnswers = (account) => {
    global.fetch = jest.fn(async (url) =>
      String(url).endsWith("/oauth2/token")
        ? { ok: true, json: async () => ({ access_token: "token" }) }
        : { ok: true, json: async () => account }
    );
  };

  const start = (user) => auth(request(app).get("/discord/oauth/start"), user);
  const callback = (query) => request(app).get("/discord/oauth/callback").query(query);

  it("hands back a discord url carrying a state only this session could have made", async () => {
    const user = await makeUser();
    const res = await start(user);
    expect(res.status).toBe(200);

    const url = new URL(res.body.url);
    expect(url.origin + url.pathname).toBe("https://discord.com/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe(CLIENT);
    // guilds.join rides along so one approval both links and seats them in the server
    expect(url.searchParams.get("scope")).toBe("identify guilds.join");
    expect(url.searchParams.get("response_type")).toBe("code");

    const claim = jwt.verify(url.searchParams.get("state"), process.env.JWT_SECRET);
    expect(claim.userId).toBe(String(user._id));
  });

  it("needs a session of its own", async () => {
    expect((await request(app).get("/discord/oauth/start")).status).toBe(401);
  });

  it("will not start for an account that is already linked", async () => {
    const user = await makeUser();
    await linkUser(user, oldEnough());
    expect((await start(user)).status).toBe(409);
  });

  it("links the account the state names, and sends them back to their settings", async () => {
    const user = await makeUser();
    const discordId = oldEnough();
    const state = (await start(user)).body.url;
    discordAnswers({ id: discordId, username: "someone" });

    const res = await callback({ code: "auth-code", state: new URL(state).searchParams.get("state") });
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`/profile/${user._id}?tab=settings&discord=linked`);

    const stored = await User.findById(user._id).select("discordId discordName").lean();
    expect(stored.discordId).toBe(discordId);
    expect(stored.discordName).toBe("someone");
  });

  it("refuses a state it did not sign", async () => {
    const forged = jwt.sign({ userId: "000000000000000000000000", use: "discord-oauth" }, "not-the-secret");
    const res = await callback({ code: "auth-code", state: forged });
    expect(res.headers.location).toContain("discord=expired");
  });

  // a login token is signed with the same secret, so the purpose has to be checked too
  it("refuses a token minted for something other than this flow", async () => {
    const user = await makeUser();
    const res = await callback({ code: "auth-code", state: tokenFor(user) });
    expect(res.headers.location).toContain("discord=failed");
    const stored = await User.findById(user._id).select("discordId").lean();
    expect(stored.discordId).toBeUndefined();
  });

  it("turns away a discord account that belongs to someone else", async () => {
    const holder = await makeUser();
    const discordId = oldEnough();
    await linkUser(holder, discordId);

    const other = await makeUser();
    const state = new URL((await start(other)).body.url).searchParams.get("state");
    discordAnswers({ id: discordId, username: "someone" });

    const res = await callback({ code: "auth-code", state });
    expect(res.headers.location).toContain("discord=taken");
    const stored = await User.findById(other._id).select("discordId").lean();
    expect(stored.discordId).toBeUndefined();
  });

  it("applies the same age rule the bot does", async () => {
    const user = await makeUser();
    const state = new URL((await start(user)).body.url).searchParams.get("state");
    discordAnswers({ id: snowflakeFor(daysAgo(2)), username: "fresh" });

    const res = await callback({ code: "auth-code", state });
    expect(res.headers.location).toContain("discord=young");
    const stored = await User.findById(user._id).select("discordId").lean();
    expect(stored.discordId).toBeUndefined();
  });

  it("survives discord refusing the code", async () => {
    const user = await makeUser();
    const state = new URL((await start(user)).body.url).searchParams.get("state");
    global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({}) }));

    const res = await callback({ code: "stale", state });
    expect(res.headers.location).toContain("discord=failed");
  });

  it("goes nowhere without a code", async () => {
    expect((await callback({})).headers.location).toContain("discord=failed");
  });
});

// the settings tab only renders for the account that owns it, so an outcome sent to
// /profile/me collapses to the inventory and the player is told nothing at all
describe("where a failed link sends the player", () => {
  const jwt = require("jsonwebtoken");

  it("lands an expired link on the settings page of whoever started it", async () => {
    const user = await makeUser();
    const stale = jwt.sign(
      { userId: String(user._id), use: "discord-oauth" },
      process.env.JWT_SECRET,
      { expiresIn: -60 }
    );

    const res = await request(app).get("/discord/oauth/callback").query({ code: "c", state: stale });
    expect(res.headers.location).toContain(`/profile/${user._id}?tab=settings&discord=expired`);
  });

  it("will not be pointed at a stranger's page by an unsigned state", async () => {
    const forged = jwt.sign({ userId: "aaaaaaaaaaaaaaaaaaaaaaaa", use: "discord-oauth" }, "not-the-secret", {
      expiresIn: -60,
    });
    const res = await request(app).get("/discord/oauth/callback").query({ code: "c", state: forged });
    expect(res.headers.location).toContain("/profile/me?tab=settings&discord=expired");
    expect(res.headers.location).not.toContain("aaaaaaaaaaaaaaaaaaaaaaaa");
  });

// The menu asks for shelves, then for a page of one shelf. Both are new surfaces on a route
// the autocomplete already depended on, so what matters is that the shelf page is a stable
// slice and that the autocomplete path is untouched by any of it.
describe("the case menu", () => {
  const CAP = 20000;
  const makeCase = (title, price, category) =>
    Case.create({ title, price, category, image: "https://example.test/c.png", items: [] });

  const categories = () => bot(request(app).get("/discord/categories"));
  const shelf = (category, offset) =>
    bot(request(app).get("/discord/cases").query(offset === undefined ? { category } : { category, offset }));

  beforeEach(async () => {
    for (let i = 0; i < 30; i += 1) await makeCase(`CS ${String(i).padStart(2, "0")}`, 10 + i, "Counter-Strike");
    await makeCase("Kivotos", 30, "Blue Archive");
    await makeCase("Millennium", 40, "Blue Archive");
  });

  it("needs the bot secret like everything else here", async () => {
    expect((await request(app).get("/discord/categories")).status).toBe(403);
  });

  it("lists a shelf per category, with its size and its cheapest case", async () => {
    const res = await categories();
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(res.body.categories.map((one) => [one.name, one]));
    expect(byName["Counter-Strike"]).toMatchObject({ count: 30, from: 10 });
    expect(byName["Blue Archive"]).toMatchObject({ count: 2, from: 30 });
  });

  // the menu must never offer what /open would then refuse to open
  it("leaves a case dearer than the cap off the shelf entirely", async () => {
    await makeCase("Katowice Legends", CAP + 1, "Souvenir");
    const names = (await categories()).body.categories.map((one) => one.name);
    expect(names).not.toContain("Souvenir");
    expect((await shelf("Counter-Strike")).body.total).toBe(30);
  });

  it("gives a case with no category a shelf that has a usable name", async () => {
    await makeCase("Loose", 25, "");
    const found = (await categories()).body.categories.find((one) => one.name === "~none");
    expect(found).toMatchObject({ count: 1 });
    expect((await shelf("~none")).body.cases.map((one) => one.title)).toEqual(["Loose"]);
  });

  it("returns one shelf, cheapest first, capped at what a select can hold", async () => {
    const res = await shelf("Counter-Strike");
    expect(res.body.cases).toHaveLength(25);
    expect(res.body.total).toBe(30);
    expect(res.body.cases.every((one) => one.category === "Counter-Strike")).toBe(true);
    const prices = res.body.cases.map((one) => one.price);
    expect([...prices]).toEqual([...prices].sort((a, b) => a - b));
  });

  // a page that reshuffles between clicks shows one case twice and hides another, which is
  // the whole reason this path does not get the autocomplete's per-player reordering
  it("pages without repeating or dropping a case", async () => {
    const first = await shelf("Counter-Strike", 0);
    const second = await shelf("Counter-Strike", 25);
    expect(second.body.cases).toHaveLength(5);
    expect(second.body.offset).toBe(25);
    const ids = [...first.body.cases, ...second.body.cases].map((one) => one.id);
    expect(new Set(ids).size).toBe(30);
  });

  it("hands back an empty page rather than failing past the end", async () => {
    const res = await shelf("Counter-Strike", 500);
    expect(res.status).toBe(200);
    expect(res.body.cases).toEqual([]);
    expect(res.body.total).toBe(30);
  });

  it("treats a shelf that does not exist as empty, not as an error", async () => {
    const res = await shelf("Nothing Here");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cases: [], total: 0 });
  });

  // the autocomplete asked for this route first and must keep the behaviour it had
  it("still answers the autocomplete with no category, unpaged", async () => {
    const res = bot(request(app).get("/discord/cases"));
    const body = (await res).body;
    expect(body.cases.length).toBe(25);
    expect(body.total).toBeUndefined();
    expect(body.maxPrice).toBe(CAP);
  });

  it("still searches by title and by series when asked to", async () => {
    const res = await bot(request(app).get("/discord/cases").query({ q: "Blue Archive" }));
    expect(res.body.cases.map((one) => one.title).sort()).toEqual(["Kivotos", "Millennium"]);
  });
});

});

describe("POST /discord/membership", () => {
  const bot = (body) => request(app).post("/discord/membership").set("x-bot-secret", SECRET).send(body);
  const linked = async (discordId, over = {}) =>
    User.create({
      username: `m${uniqueSuffix()}`,
      email: `m${uniqueSuffix()}@k.co`,
      password: "x",
      discordId,
      ...over,
    });

  it("records a join, so the gift can pay the boost without asking discord", async () => {
    const u = await linked("100000000000000001");

    const res = await bot({ discordId: "100000000000000001", guildId: GUILD, present: true });

    expect(res.status).toBe(200);
    expect((await User.findById(u._id)).discordInGuild).toBe(true);
  });

  it("takes the boost away again when they leave", async () => {
    const u = await linked("100000000000000002", { discordInGuild: true });

    await bot({ discordId: "100000000000000002", guildId: GUILD, present: false });

    expect((await User.findById(u._id)).discordInGuild).toBe(false);
  });

  it("ignores a server that is not the home one", async () => {
    const u = await linked("100000000000000003");

    const res = await bot({ discordId: "100000000000000003", guildId: OTHER_GUILD, present: true });

    expect(res.status).toBe(400);
    expect((await User.findById(u._id)).discordInGuild).toBeUndefined();
  });

  it("takes a full member list and treats everyone missing from it as gone", async () => {
    // the boot sync, which is what heals a join or a leave the bot was down for
    const stays = await linked("100000000000000004");
    const left = await linked("100000000000000005", { discordInGuild: true });

    const res = await bot({ guildId: GUILD, members: ["100000000000000004"] });

    expect(res.status).toBe(200);
    expect((await User.findById(stays._id)).discordInGuild).toBe(true);
    expect((await User.findById(left._id)).discordInGuild).toBe(false);
  });

  it("is closed to anything without the bot secret", async () => {
    const res = await request(app)
      .post("/discord/membership")
      .send({ discordId: "100000000000000006", guildId: GUILD, present: true });

    expect(res.status).toBe(403);
  });
});
