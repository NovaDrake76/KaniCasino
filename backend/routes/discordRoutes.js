const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const router = express.Router();

const User = require("../models/User");
const DiscordLink = require("../models/DiscordLink");
const FanBoard = require("../models/FanBoard");
const Case = require("../models/Case");
const Roll = require("../models/Roll");
const DiscordOpen = require("../models/DiscordOpen");
const { isAuthenticated } = require("../middleware/authMiddleware");
const { visible } = require("../utils/visibility");
const badges = require("../utils/badges");
const { openCase, MAX_PER_OPEN } = require("../games/openCase");
const { pickFromRanges, TOTAL } = require("../utils/provablyFair");
const { buildRangeTable } = require("../utils/caseRanges");
const { sellValue } = require("../utils/itemValue");

// how long a link code stays redeemable. long enough to switch to a browser and log in,
// short enough that a code read off someone else's screen is worthless by the time it lands.
const LINK_TTL_MS = 15 * 60 * 1000;
// a discord account younger than this cannot link. the snowflake carries its creation
// time, so throwaway alts farming the bonus are turned away without a lookup.
const MIN_ACCOUNT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DISCORD_EPOCH = 1420070400000;
// how many rows a server board hands back, which is also what caps every query below
const BOARD_ROWS = 15;
// a player is only ever counted in this many servers, so the array cannot grow unbounded
const MAX_GUILDS = 25;

// the only fields the bot is ever given. the inventory is never one of them: it reaches
// 21k entries, and everything these cards show is already summarised on the document.
const CARD_FIELDS = {
  username: 1,
  level: 1,
  xp: 1,
  profilePicture: 1,
  fixedItem: 1,
  fanRank: 1,
  collectionRank: 1,
  badges: 1,
  selectedBadge: 1,
  discordId: 1,
  discordName: 1,
};

// a player types this into autocomplete, so it is data, never pattern
const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// no ambiguous glyphs: this gets read off a phone screen and typed back
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const makeCode = () =>
  Array.from(crypto.randomBytes(8), (byte) => ALPHABET[byte % ALPHABET.length]).join("");

const snowflakeDate = (id) => {
  if (!/^\d{5,25}$/.test(String(id || ""))) return null;
  return new Date(Number(BigInt(id) >> 22n) + DISCORD_EPOCH);
};

// the bot is the only caller. the site api key ships inside the frontend bundle, so it
// cannot be what guards a route that mints link codes for an arbitrary discord id.
const botOnly = (req, res, next) => {
  const expected = process.env.DISCORD_BOT_SECRET;
  if (!expected) return res.status(503).json({ message: "Discord bot is not configured" });
  const given = req.headers["x-bot-secret"];
  if (typeof given !== "string" || given.length !== expected.length) {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (!crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

const publicCard = (user) => ({
  userId: user._id,
  username: user.username,
  level: user.level || 0,
  xp: user.xp || 0,
  profilePicture: user.profilePicture || null,
  discordName: user.discordName || null,
  pinned:
    user.fixedItem && user.fixedItem.name
      ? {
          name: user.fixedItem.name,
          variant: user.fixedItem.variant || null,
          image: user.fixedItem.image || null,
          rarity: user.fixedItem.rarity || null,
        }
      : null,
  fanRank:
    user.fanRank && user.fanRank.name
      ? {
          name: user.fanRank.name,
          count: user.fanRank.count || 0,
          rank: user.fanRank.rank || null,
          fans: user.fanRank.fans || 0,
          second: user.fanRank.second || 0,
        }
      : null,
  collection: user.collectionRank
    ? {
        distinct: user.collectionRank.distinct || 0,
        total: user.collectionRank.total || 0,
        rank: user.collectionRank.rank || null,
      }
    : null,
  badge: badges.wornBadge(user) || null,
});

// a linked player running a command here is what puts them on this server's boards. it is
// who plays rather than who is a member, so the bot never needs the guild member list.
router.post("/seen", botOnly, async (req, res) => {
  try {
    const discordId = String((req.body && req.body.discordId) || "");
    const guildId = String((req.body && req.body.guildId) || "");
    if (!discordId || !guildId) return res.status(400).json({ message: "Missing discordId or guildId" });

    await User.updateOne(
      { discordId, discordGuilds: { $ne: guildId } },
      // push rather than addToSet because only push can cap the array, and the $ne in the
      // filter is what makes the two equivalent here
      { $push: { discordGuilds: { $each: [guildId], $slice: -MAX_GUILDS } } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("discord seen:", err.message);
    res.status(500).json({ message: "Could not record the server" });
  }
});

router.post("/link/start", botOnly, async (req, res) => {
  try {
    const discordId = String((req.body && req.body.discordId) || "");
    const discordName = String((req.body && req.body.discordName) || "").slice(0, 64);
    if (!/^\d{5,25}$/.test(discordId)) return res.status(400).json({ message: "Missing discordId" });

    const born = snowflakeDate(discordId);
    if (!born || Date.now() - born.getTime() < MIN_ACCOUNT_AGE_MS) {
      return res.status(403).json({ message: "Discord accounts under 30 days old cannot be linked yet." });
    }

    const existing = await User.findOne({ discordId }, { username: 1 }).lean();
    if (existing) return res.json({ alreadyLinked: true, username: existing.username });

    const code = makeCode();
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);
    await DiscordLink.findOneAndUpdate(
      { discordId },
      { $set: { code, discordName, expiresAt, createdAt: new Date() } },
      { upsert: true }
    );

    const site = (process.env.SITE_URL || "https://kanicasino.com").replace(/\/$/, "");
    res.json({ code, url: site + "/link/discord?code=" + code, expiresAt });
  } catch (err) {
    console.error("discord link start:", err.message);
    res.status(500).json({ message: "Could not start the link" });
  }
});

// redeemed from the site, by whoever is logged in there. that session is the proof of
// which account is being linked, which is why the bot cannot do this half on its own.
router.post("/link/complete", isAuthenticated, async (req, res) => {
  try {
    const code = String((req.body && req.body.code) || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ message: "Missing code" });

    const pending = await DiscordLink.findOne({ code }).lean();
    if (!pending || pending.expiresAt <= new Date()) {
      return res.status(404).json({ message: "That code has expired. Run /link again in Discord." });
    }

    const taken = await User.findOne({ discordId: pending.discordId }, { username: 1 }).lean();
    if (taken) {
      await DiscordLink.deleteOne({ code });
      return res.status(409).json({ message: "That Discord account is already linked to " + taken.username + ". Unlink it from that account's settings tab first." });
    }

    const mine = await User.findById(req.user._id, { discordId: 1, username: 1 }).lean();
    if (!mine) return res.status(404).json({ message: "User not found" });
    if (mine.discordId) {
      return res.status(409).json({ message: "This account is already linked to a Discord user. Change it from the settings tab on your profile." });
    }

    const done = await User.updateOne(
      { _id: req.user._id, discordId: { $exists: false } },
      { $set: { discordId: pending.discordId, discordName: pending.discordName, discordLinkedAt: new Date() } }
    );
    if (!done.modifiedCount) return res.status(409).json({ message: "This account is already linked. Change it from the settings tab on your profile." });
    await DiscordLink.deleteOne({ code });

    res.json({ username: mine.username, discordName: pending.discordName || null });
  } catch (err) {
    // the unique index is the real guard against two accounts racing for one discord id
    if (err && err.code === 11000) {
      return res.status(409).json({ message: "That Discord account is already linked. Unlink it from that account first." });
    }
    console.error("discord link complete:", err.message);
    res.status(500).json({ message: "Could not finish the link" });
  }
});

router.delete("/link", isAuthenticated, async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $unset: { discordId: "", discordName: "", discordLinkedAt: "", discordGuilds: "" } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("discord unlink:", err.message);
    res.status(500).json({ message: "Could not unlink" });
  }
});

// whether the logged-in player has a discord account attached, for the profile page
router.get("/link/me", isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user._id, { discordName: 1, discordId: 1, discordLinkedAt: 1 }).lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      linked: !!user.discordId,
      discordName: user.discordName || null,
      linkedAt: user.discordLinkedAt || null,
    });
  } catch (err) {
    console.error("discord link me:", err.message);
    res.status(500).json({ message: "Could not read your link" });
  }
});

// linking the other way round: from the site, with no bot involved. discord is the only
// thing that can say which account a browser belongs to, so it has to be asked directly.
const DISCORD_API = "https://discord.com/api/v10";
const OAUTH_TTL = "10m";

const siteUrl = () => (process.env.SITE_URL || "https://kanicasino.com").replace(/\/$/, "");
const redirectUri = () =>
  process.env.DISCORD_REDIRECT_URI || `${(process.env.API_URL || "").replace(/\/$/, "")}/discord/oauth/callback`;

router.get("/oauth/start", isAuthenticated, async (req, res) => {
  try {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
      return res.status(503).json({ message: "Discord linking is not configured" });
    }
    const mine = await User.findById(req.user._id, { discordId: 1 }).lean();
    if (!mine) return res.status(404).json({ message: "User not found" });
    if (mine.discordId) return res.status(409).json({ message: "This account is already linked to a Discord user. Change it from the settings tab on your profile." });

    // the state is signed rather than stored: it says which session opened the flow, it
    // expires on its own, and a callback replayed by anyone else carries no session at all
    const state = jwt.sign({ userId: String(req.user._id), use: "discord-oauth" }, process.env.JWT_SECRET, {
      expiresIn: OAUTH_TTL,
    });
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", process.env.DISCORD_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("response_type", "code");
    // identify is the whole ask: an id and a name, no email, no servers, no messages
    url.searchParams.set("scope", "identify");
    url.searchParams.set("state", state);
    res.json({ url: url.toString() });
  } catch (err) {
    console.error("discord oauth start:", err.message);
    res.status(500).json({ message: "Could not start linking" });
  }
});

// discord sends the player's browser here, so it carries no api key and no bearer token.
// mounted ahead of the api-key gate in index.js, and everything it trusts comes out of the
// signed state or from discord itself.
async function oauthCallback(req, res) {
  const done = (userId, status) =>
    res.redirect(`${siteUrl()}/profile/${userId || "me"}?tab=settings&discord=${status}`);

  let userId = null;
  try {
    const { code, state } = req.query;
    if (!code || !state) return done(null, "failed");

    let claim;
    try {
      claim = jwt.verify(String(state), process.env.JWT_SECRET);
    } catch {
      // the signature is still checked, so this cannot be pointed anywhere by a stranger.
      // it only recovers whose settings page to land on: the answer is still no.
      let expired = null;
      try {
        expired = jwt.verify(String(state), process.env.JWT_SECRET, { ignoreExpiration: true });
      } catch {
        expired = null;
      }
      return done(expired && expired.use === "discord-oauth" ? expired.userId : null, "expired");
    }
    if (claim.use !== "discord-oauth") return done(null, "failed");
    userId = claim.userId;

    const token = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code: String(code),
        redirect_uri: redirectUri(),
      }),
      signal: AbortSignal.timeout(8000),
    }).then((r) => (r.ok ? r.json() : null));
    if (!token || !token.access_token) return done(userId, "failed");

    const me = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(8000),
    }).then((r) => (r.ok ? r.json() : null));
    if (!me || !me.id) return done(userId, "failed");

    const born = snowflakeDate(me.id);
    if (!born || Date.now() - born.getTime() < MIN_ACCOUNT_AGE_MS) return done(userId, "young");

    const taken = await User.findOne({ discordId: me.id }, { _id: 1 }).lean();
    if (taken) return done(userId, String(taken._id) === String(userId) ? "already" : "taken");

    const written = await User.updateOne(
      { _id: userId, discordId: { $exists: false } },
      { $set: { discordId: me.id, discordName: me.username || null, discordLinkedAt: new Date() } }
    );
    if (!written.modifiedCount) return done(userId, "already");
    return done(userId, "linked");
  } catch (err) {
    // the unique index is still the last word if two browsers race the same discord account
    if (err && err.code === 11000) return done(userId, "taken");
    console.error("discord oauth callback:", err.message);
    return done(userId, "failed");
  }
}

// the dearest cases stay on the site. a chat window is a fine place to pull a character
// out of a 12k case and a poor one to spend a million, and the reveal that makes an
// expensive opening worth watching does not survive the trip into an embed.
const MAX_CASE_PRICE = Number(process.env.DISCORD_MAX_CASE_PRICE || 20000);
// how many the autocomplete can show
const CASE_CHOICES = 25;

const publicCase = (one) => ({
  id: one._id,
  title: one.title,
  price: one.price || 0,
  image: one.image || null,
  category: one.category || "",
});

// what the bot offers in autocomplete. with an empty box it leads with the cases this
// player last opened, which is what makes opening the same one again quick to type.
router.get("/cases", botOnly, async (req, res) => {
  try {
    const search = String(req.query.q || "").trim();
    const filter = { price: { $lte: MAX_CASE_PRICE } };
    if (search) {
      filter.title = { $regex: escapeRegex(search), $options: "i" };
    }

    const found = await Case.find(filter, { title: 1, price: 1, image: 1, category: 1 })
      .sort({ price: 1 })
      .limit(CASE_CHOICES * 2)
      .lean();

    let ordered = found;
    const discordId = String(req.query.discordId || "");
    if (!search && discordId) {
      const user = await User.findOne({ discordId }, { _id: 1 }).lean();
      if (user) {
        // rolls carry the case and are already indexed on user and time, and they expire
        // themselves, so "recently opened" costs one bounded lookup and no new storage
        const recent = await Roll.find({ userId: user._id, game: "case" }, { caseId: 1 })
          .sort({ createdAt: -1 })
          .limit(40)
          .lean();
        const rank = new Map();
        for (const roll of recent) {
          const key = String(roll.caseId);
          if (!rank.has(key)) rank.set(key, rank.size);
        }
        ordered = [...found].sort(
          (a, b) => (rank.has(String(a._id)) ? rank.get(String(a._id)) : 999) -
                    (rank.has(String(b._id)) ? rank.get(String(b._id)) : 999)
        );
      }
    }

    res.json({ cases: ordered.slice(0, CASE_CHOICES).map(publicCase), maxPrice: MAX_CASE_PRICE });
  } catch (err) {
    console.error("discord cases:", err.message);
    res.status(500).json({ message: "Could not load the cases" });
  }
});

// a spin for somebody with no account. it draws on the case's real committed odds so the
// answer is honest, consumes no nonce, stores nothing and hands nothing over. the point
// is to show what the game is, and the bot must say plainly that the item was not kept.
router.get("/preview/:caseId", botOnly, async (req, res) => {
  try {
    const one = await Case.findById(req.params.caseId).populate("items");
    if (!one) return res.status(404).json({ message: "Case not found" });
    if ((one.price || 0) > MAX_CASE_PRICE) return res.status(403).json({ message: "That case is site only" });

    let rangeTable = one.rangeTable;
    if (!rangeTable || !rangeTable.length) rangeTable = buildRangeTable(one).rangeTable;

    // not provably fair, and it does not need to be: nothing is won, so there is nothing
    // to prove. the odds are the case's own, which is the part that has to be true.
    const drawn = pickFromRanges(crypto.randomInt(1, TOTAL + 1), rangeTable);
    const item = one.items.find((it) => String(it._id) === String(drawn.itemId));
    if (!item) return res.status(500).json({ message: "Case has no items" });

    res.json({
      kept: false,
      case: publicCase(one),
      item: {
        name: item.name,
        image: item.image,
        rarity: item.rarity,
        value: sellValue(item.baseValue),
      },
      reel: one.items.slice(0, 12).map((it) => it.name),
    });
  } catch (err) {
    console.error("discord preview:", err.message);
    res.status(500).json({ message: "Could not spin that case" });
  }
});

// the real thing, for a linked account, through the same path the site uses
router.post("/open", botOnly, async (req, res) => {
  try {
    const discordId = String((req.body && req.body.discordId) || "");
    const interactionId = String((req.body && req.body.interactionId) || "");
    const caseId = String((req.body && req.body.caseId) || "");
    // `|| 1` would turn a zero into a one, which is the one bad quantity that looks fine
    const asked = req.body ? req.body.quantity : undefined;
    const quantity = asked === undefined || asked === null ? 1 : Number(asked);
    if (!discordId || !interactionId || !caseId) {
      return res.status(400).json({ message: "Missing discordId, interactionId or caseId" });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PER_OPEN) {
      return res.status(400).json({ message: `Open between 1 and ${MAX_PER_OPEN} at a time` });
    }

    const user = await User.findOne(visible({ discordId }), { password: 0, inventory: 0 });
    if (!user) return res.status(404).json({ message: "Not linked" });

    const one = await Case.findById(caseId, { price: 1, title: 1 }).lean();
    if (!one) return res.status(404).json({ message: "Case not found" });
    if ((one.price || 0) > MAX_CASE_PRICE) {
      return res.status(403).json({ message: "That case can only be opened on the site" });
    }

    // claim the interaction before charging. the unique index is what makes this a claim
    // rather than a check, so a replayed interaction loses the race instead of charging.
    try {
      await DiscordOpen.create({ interactionId, userId: user._id });
    } catch (err) {
      if (err && err.code === 11000) return res.status(409).json({ message: "Already opened", duplicate: true });
      throw err;
    }

    const result = await openCase({ user, caseId, quantity, source: "discord" });
    if (!result.ok) {
      // it never happened, so the interaction is free to be tried again
      await DiscordOpen.deleteOne({ interactionId }).catch(() => {});
      return res.status(result.status).json({ message: result.message });
    }

    res.json({
      case: { id: one._id, title: one.title, price: one.price || 0 },
      cost: result.cost,
      walletBalance: result.walletBalance,
      level: result.level,
      items: result.items.map((item) => ({
        name: item.name,
        image: item.image,
        rarity: item.rarity,
        value: item.sellValue,
        rollId: item.rollId,
      })),
    });
  } catch (err) {
    console.error("discord open:", err.message);
    res.status(500).json({ message: "Could not open that case" });
  }
});

router.get("/showcase/:discordId", botOnly, async (req, res) => {
  try {
    const user = await User.findOne(visible({ discordId: String(req.params.discordId) }), CARD_FIELDS).lean();
    if (!user) return res.status(404).json({ message: "Not linked" });
    res.json(publicCard(user));
  } catch (err) {
    console.error("discord showcase:", err.message);
    res.status(500).json({ message: "Could not load that player" });
  }
});

// one board, narrowed to the players who use the bot in this server. the board document
// already carries its top rows, so this reads one small document and one id lookup.
router.get("/topfan/:name", botOnly, async (req, res) => {
  try {
    const guildId = String(req.query.guild || "");
    if (!guildId) return res.status(400).json({ message: "Missing guild" });

    const escaped = escapeRegex(req.params.name);
    const board = await FanBoard.findOne(
      { name: new RegExp("^" + escaped + "$", "i") },
      { name: 1, image: 1, rarity: 1, ranks: 1, fanCount: 1, topCount: 1 }
    ).lean();
    if (!board) return res.status(404).json({ message: "No such character" });

    const rows = board.ranks || [];
    const card = {
      name: board.name,
      image: board.image,
      rarity: board.rarity,
      global: board.topCount || 0,
      fanCount: board.fanCount || 0,
    };
    if (!rows.length) return res.json({ ...card, ranks: [] });

    // capped by RANKS_KEPT on the board, so this $in stays bounded whatever the playerbase does
    const here = await User.find(
      visible({ _id: { $in: rows.map((row) => row.userId) }, discordGuilds: guildId }),
      { _id: 1, discordName: 1 }
    ).lean();
    const mine = new Map(here.map((row) => [String(row._id), row.discordName || null]));

    res.json({
      ...card,
      ranks: rows
        .filter((row) => mine.has(String(row.userId)))
        .slice(0, BOARD_ROWS)
        .map((row) => ({
          userId: row.userId,
          username: row.username,
          level: row.level || 0,
          count: row.count || 0,
          discordName: mine.get(String(row.userId)),
        })),
    });
  } catch (err) {
    console.error("discord topfan:", err.message);
    res.status(500).json({ message: "Could not load that board" });
  }
});

// who in this server is worth beating. sorted on fields the fandom sweep already
// materialised, so nothing here counts an inventory.
router.get("/leaderboard", botOnly, async (req, res) => {
  try {
    const guildId = String(req.query.guild || "");
    if (!guildId) return res.status(400).json({ message: "Missing guild" });
    const sort = String(req.query.sort || "level");

    const order =
      sort === "collection"
        ? { "collectionRank.distinct": -1, "collectionRank.total": -1 }
        : { level: -1, xp: -1 };

    const rows = await User.find(visible({ discordGuilds: guildId }), CARD_FIELDS)
      .sort(order)
      .limit(BOARD_ROWS)
      .lean();

    res.json({ sort, players: rows.map(publicCard) });
  } catch (err) {
    console.error("discord leaderboard:", err.message);
    res.status(500).json({ message: "Could not load the leaderboard" });
  }
});

// attached rather than routed: index.js mounts it ahead of the api-key gate
router.oauthCallback = oauthCallback;

module.exports = router;
