const Transaction = require("../models/Transaction");
const User = require("../models/User");
const realtime = require("./realtime");
const badges = require("./badges");
const { TX } = require("./economy");
const { VISIBLE } = require("./visibility");

// the shared bet ticker under every game canvas. it is derived, not stored: each entry is
// broadcast at the moment a game settles, from numbers the server already holds, and kept
// in memory. nothing is written, so this adds no rows and no growth to a database whose
// link is the scarce resource.
const KEEP = 50;
const buffer = [];

// one player can bet far faster than a table can be read: a dice run of 733 bets in seven
// minutes would be every row on the board at once, on every game page. one entry per
// player per window keeps the feed a picture of the room rather than of the busiest bot.
const PER_USER_MS = 4000;
const lastSeen = new Map();

// the window a boot seed will reach back over. older than this is not "live", and showing
// it as if it were is the fake-feed problem in miniature.
const SEED_WINDOW_MS = 30 * 60 * 1000;

const WIN_META = {
  [TX.CRASH_CASHOUT]: "crash",
  [TX.COINFLIP_WIN]: "coinflip",
  [TX.DICE_WIN]: "dice",
  [TX.PLINKO_WIN]: "plinko",
  [TX.MINES_WIN]: "mines",
  [TX.HILO_WIN]: "hilo",
  [TX.SLOT_WIN]: "slots",
  [TX.BLACKJACK_WIN]: "blackjack",
};

const round2 = (n) => Math.round(n * 100) / 100;

// a payout of zero is a loss, which the table shows as the stake going the other way
const entryFor = ({ game, user, userId, bet, payout }) => ({
  id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  at: Date.now(),
  game,
  userId: String(userId || user._id),
  username: user.username,
  profilePicture: user.profilePicture,
  level: user.level,
  badge: badges.wornBadge(user),
  bet: round2(bet),
  multiplier: bet > 0 ? round2(payout / bet) : 0,
  payout: round2(payout),
});

const CARD = "username profilePicture level fanRank selectedBadge badges disabled";

// a loss path often holds only the id. the throttle runs first, so at most one lookup per
// player per window ever happens, and it never reads the inventory.
async function resolveUser(user, userId) {
  if (user && user._id) return user;
  if (!userId) return null;
  return User.findById(userId).select(CARD).lean();
}

// push one settled bet onto the feed and tell everyone watching. never throws and is never
// awaited: a ticker must not be able to fail a bet that has already been paid.
async function publish({ game, user, userId, bet, payout }) {
  try {
    const id = String((user && user._id) || userId || "");
    if (!id || !(bet > 0)) return null;

    const now = Date.now();
    if (now - (lastSeen.get(id) || 0) < PER_USER_MS) return null;
    lastSeen.set(id, now);

    const doc = await resolveUser(user, userId);
    if (!doc) return null;
    if (doc.disabled) return null; // a banned name must not broadcast to every page

    // never spread the doc: a mongoose document spreads its internals, not its fields
    const entry = entryFor({ game, user: doc, userId: id, bet, payout });
    buffer.unshift(entry);
    buffer.length = Math.min(buffer.length, KEEP);

    const io = realtime.getIo();
    if (io) io.emit("liveBet", entry);
    return entry;
  } catch (err) {
    console.error("liveFeed.publish failed", err);
    return null;
  }
}

const recent = () => buffer.slice();

// fill the buffer once at boot so a restart does not leave the table blank. win rows carry
// betAmount and a payout or a multiplier already, so the whole row rebuilds from one read.
// losses write only a stake row and are left to live traffic, which corrects the mix
// within a few bets.
async function seed() {
  try {
    const types = Object.keys(WIN_META);
    const rows = await Transaction.find({
      type: { $in: types },
      createdAt: { $gte: new Date(Date.now() - SEED_WINDOW_MS) },
    })
      .sort({ createdAt: -1 })
      .limit(KEEP)
      .select("userId type amount meta createdAt")
      .lean();
    if (!rows.length) return 0;

    const ids = [...new Set(rows.map((r) => String(r.userId)))];
    const users = await User.find({ _id: { $in: ids }, ...VISIBLE })
      .select("username profilePicture level fanRank selectedBadge badges")
      .lean();
    const byId = new Map(users.map((u) => [String(u._id), u]));

    const seeded = [];
    for (const row of rows) {
      const user = byId.get(String(row.userId));
      if (!user) continue;
      const bet = Number(row.meta && row.meta.betAmount) || 0;
      if (!(bet > 0)) continue;
      const payout = Number(row.meta && (row.meta.payout ?? row.meta.totalPayout)) || row.amount;
      const entry = entryFor({ game: WIN_META[row.type], user, bet, payout });
      entry.at = new Date(row.createdAt).getTime();
      seeded.push(entry);
    }

    buffer.length = 0;
    buffer.push(...seeded.slice(0, KEEP));
    return buffer.length;
  } catch (err) {
    console.error("liveFeed.seed failed", err);
    return 0;
  }
}

// tests need a clean slate between cases
const reset = () => {
  buffer.length = 0;
  lastSeen.clear();
};

module.exports = { publish, recent, seed, reset, KEEP, PER_USER_MS, SEED_WINDOW_MS };
