const mongoose = require("mongoose");
const User = require("../models/User");
const Case = require("../models/Case");
const Transaction = require("../models/Transaction");
const { accountBalance, ledgerSupply, TX, STAKE_TYPES } = require("./economy");
const { HOUSE, MINT, ESCROW, GENESIS } = require("./accounts");

const PAGE_SIZE = 20;

// KP-paying game wins and stake returns, for daily series and big-win surfacing
const WIN_TYPES = [TX.SLOT_WIN, TX.PLINKO_WIN, TX.BLACKJACK_WIN, TX.CRASH_CASHOUT, TX.COINFLIP_WIN];
const REFUND_TYPES = [TX.CRASH_REFUND, TX.COINFLIP_REFUND, TX.BATTLE_REFUND, TX.BLACKJACK_PUSH, TX.BLACKJACK_REFUND];
// KP printed to players outside the games
const FAUCET_TYPES = [TX.SIGNUP, TX.BONUS, TX.MISSION_REWARD, TX.REFERRAL_BONUS, TX.REFERRAL_MILESTONE, TX.AD_REWARD];
// designed edges per game, so the realized return can be judged against intent
const THEO_RTP = { crash: 0.9603, coinflip: 0.97, slots: 0.9645, plinko: 0.9655, blackjack: 0.9943, cases: 0.9, battles: 0.9 };

// window start, or null for all-time
const sinceFor = (days) => {
  const n = Number(days);
  return Number.isFinite(n) && n > 0 ? new Date(Date.now() - n * 24 * 60 * 60 * 1000) : null;
};
const matchSince = (since) => (since ? { createdAt: { $gte: since } } : {});

async function overview(days) {
  const since = sinceFor(days);
  const [totalUsers, newUsers, activeAgg, supply, house, escrow] = await Promise.all([
    User.countDocuments({}),
    since
      ? User.countDocuments({ _id: { $gte: mongoose.Types.ObjectId.createFromTime(Math.floor(since.getTime() / 1000)) } })
      : User.countDocuments({}),
    Transaction.aggregate([{ $match: matchSince(since) }, { $group: { _id: "$userId" } }, { $count: "n" }]),
    ledgerSupply(),
    accountBalance(HOUSE),
    accountBalance(ESCROW),
  ]);
  return {
    users: { total: totalUsers, new: newUsers, active: activeAgg.length ? activeAgg[0].n : 0 },
    economy: { supply, houseBalance: house, escrow },
  };
}

// what each game charges and what it pays back in KP. cases and battles pay in items,
// so their KP outflow shows up later as item_sell buybacks, listed with the house lines.
const GAME_LINES = [
  { game: "crash", bets: [TX.CRASH_BET], outs: [TX.CRASH_CASHOUT, TX.CRASH_REFUND] },
  { game: "coinflip", bets: [TX.COINFLIP_BET], outs: [TX.COINFLIP_WIN, TX.COINFLIP_REFUND] },
  { game: "slots", bets: [TX.SLOT_BET], outs: [TX.SLOT_WIN] },
  { game: "plinko", bets: [TX.PLINKO_BET], outs: [TX.PLINKO_WIN] },
  { game: "blackjack", bets: [TX.BLACKJACK_BET], outs: [TX.BLACKJACK_WIN, TX.BLACKJACK_PUSH, TX.BLACKJACK_REFUND] },
  { game: "cases", bets: [TX.CASE_OPEN], outs: [] },
  { game: "battles", bets: [TX.BATTLE_ENTRY], outs: [TX.BATTLE_REFUND] },
];

// blackjack charges BLACKJACK_BET again on double/split/insurance, so a raw debit
// count overcounts hands; the deal row is the only one with no side-action marker
const blackjackHandsMatch = (since) => ({
  type: TX.BLACKJACK_BET,
  direction: "debit",
  "meta.double": { $ne: true },
  "meta.split": { $ne: true },
  "meta.insurance": { $ne: true },
  ...matchSince(since),
});

async function gameStats(days) {
  const since = sinceFor(days);
  // a system account can sit on either side of a row (market fees are written with
  // HOUSE as the userId), so keep which one without exploding the group by real users
  const rows = await Transaction.aggregate([
    { $match: matchSince(since) },
    {
      $group: {
        _id: {
          type: "$type",
          direction: "$direction",
          counterparty: "$counterparty",
          sysUser: { $cond: [{ $in: ["$userId", [HOUSE, MINT]] }, "$userId", null] },
        },
        amount: { $sum: "$amount" },
        count: { $sum: 1 },
        qty: { $sum: { $ifNull: ["$meta.quantity", 0] } },
      },
    },
  ]);

  const byTypeDir = {};
  for (const r of rows) {
    const key = `${r._id.type}:${r._id.direction}`;
    const slot = byTypeDir[key] || (byTypeDir[key] = { amount: 0, count: 0, qty: 0 });
    slot.amount += r.amount;
    slot.count += r.count;
    slot.qty += r.qty;
  }
  const sumOf = (types, dir) =>
    types.reduce((s, t) => s + ((byTypeDir[`${t}:${dir}`] || {}).amount || 0), 0);

  // per-type reach and outliers feed the enriched game rows
  const gameTypes = new Set(GAME_LINES.flatMap((g) => [...g.bets, ...g.outs]));
  const perType = await Transaction.aggregate([
    { $match: { type: { $in: [...gameTypes] }, ...matchSince(since) } },
    { $group: { _id: "$type", users: { $addToSet: "$userId" }, maxAmount: { $max: "$amount" } } },
    { $project: { users: { $size: "$users" }, maxAmount: 1 } },
  ]);
  const reach = new Map(perType.map((r) => [r._id, r]));

  const [bjHands] = await Transaction.aggregate([
    { $match: blackjackHandsMatch(since) },
    { $count: "n" },
  ]);
  const blackjackHands = bjHands ? bjHands.n : 0;

  const games = GAME_LINES.map(({ game, bets, outs }) => {
    const betSlot = byTypeDir[`${bets[0]}:debit`] || { amount: 0, count: 0, qty: 0 };
    const plays =
      game === "cases" ? betSlot.qty || betSlot.count
      : game === "blackjack" ? blackjackHands
      : betSlot.count;
    const wagered = sumOf(bets, "debit");
    const paidOut = sumOf(outs, "credit");
    const uniquePlayers = (reach.get(bets[0]) || {}).users || 0;
    const biggestWin = outs.reduce((m, t) => Math.max(m, (reach.get(t) || {}).maxAmount || 0), 0);
    return {
      game,
      plays,
      wagered,
      paidOut,
      net: wagered - paidOut,
      uniquePlayers,
      biggestWin,
      theoRtp: THEO_RTP[game] || null,
    };
  }).sort((a, b) => b.net - a.net);

  // everything else settling against the house or the mint, signed from the house's
  // and the supply's point of view; grouped by type so new lines appear on their own
  const houseLines = [];
  const issuance = [];
  const acc = {};
  for (const r of rows) {
    const cp = String(r._id.counterparty || "");
    const sys = String(r._id.sysUser || "");
    const account = [String(HOUSE), String(MINT)].find((a) => a === cp || a === sys);
    if (!account) continue;
    if (account === String(HOUSE) && gameTypes.has(r._id.type)) continue;
    // as counterparty the account gains what the user pays; as the row's owner it is
    // the account itself being credited or debited
    const gain = account === cp ? r._id.direction === "debit" : r._id.direction === "credit";
    const key = `${account}:${r._id.type}`;
    const slot = acc[key] || (acc[key] = { type: r._id.type, cp: account, net: 0, count: 0 });
    slot.net += (gain ? 1 : -1) * r.amount;
    slot.count += r.count;
  }
  for (const slot of Object.values(acc)) {
    if (slot.cp === String(HOUSE)) houseLines.push({ type: slot.type, net: slot.net, count: slot.count });
    else issuance.push({ type: slot.type, issued: -slot.net, count: slot.count });
  }
  houseLines.sort((a, b) => b.net - a.net);
  issuance.sort((a, b) => b.issued - a.issued);

  return { games, houseLines, issuance };
}

async function caseStats(days) {
  const since = sinceFor(days);
  const rows = await Transaction.aggregate([
    { $match: { type: TX.CASE_OPEN, "meta.caseId": { $exists: true }, ...matchSince(since) } },
    {
      $group: {
        _id: "$meta.caseId",
        opens: { $sum: { $max: [{ $ifNull: ["$meta.quantity", 1] }, 1] } },
        spent: { $sum: "$amount" },
        title: { $last: "$meta.caseTitle" },
        lastOpened: { $max: "$createdAt" },
      },
    },
    { $sort: { opens: -1 } },
    { $limit: 50 },
  ]);

  const cases = await Case.find({ _id: { $in: rows.map((r) => r._id) } }, { image: 1, price: 1 }).lean();
  const byId = new Map(cases.map((c) => [String(c._id), c]));
  return rows.map((r) => {
    const live = byId.get(String(r._id));
    return {
      caseId: String(r._id),
      title: r.title || "(deleted case)",
      image: live ? live.image : null,
      price: live ? live.price : null,
      opens: r.opens,
      spent: r.spent,
      lastOpened: r.lastOpened,
    };
  });
}

// daily buckets for the dashboard charts; all-time falls back to the last 90 days
// so the series stays bounded. system accounts are excluded so player counts are real.
async function timeseries(days) {
  const since = sinceFor(days) || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const rows = await Transaction.aggregate([
    { $match: { createdAt: { $gte: since }, userId: { $nin: [HOUSE, MINT, ESCROW, GENESIS] } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        wagered: { $sum: { $cond: [{ $in: ["$type", STAKE_TYPES] }, "$amount", 0] } },
        paidOut: { $sum: { $cond: [{ $in: ["$type", [...WIN_TYPES, ...REFUND_TYPES]] }, "$amount", 0] } },
        faucet: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$counterparty", MINT] }, { $eq: ["$direction", "credit"] }] },
              "$amount",
              0,
            ],
          },
        },
        players: { $addToSet: "$userId" },
      },
    },
    { $project: { wagered: 1, paidOut: 1, faucet: 1, players: { $size: "$players" } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({
    day: r._id,
    wagered: r.wagered,
    paidOut: r.paidOut,
    ggr: r.wagered - r.paidOut,
    faucet: r.faucet,
    players: r.players,
  }));
}

// the largest single game payouts in the window, with who hit them
async function bigWins(days, limit = 10) {
  const since = sinceFor(days);
  const rows = await Transaction.find({ type: { $in: WIN_TYPES }, ...matchSince(since) })
    .sort({ amount: -1 })
    .limit(limit)
    .select("userId type amount meta createdAt")
    .lean();
  const users = await User.find(
    { _id: { $in: rows.map((r) => r.userId) } },
    { username: 1, profilePicture: 1 }
  ).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return rows.map((r) => {
    const u = byId.get(String(r.userId));
    const bet = r.meta && r.meta.betAmount ? r.meta.betAmount : null;
    return {
      userId: String(r.userId),
      username: u ? u.username : "(deleted user)",
      profilePicture: u ? u.profilePicture || "" : "",
      type: r.type,
      amount: r.amount,
      bet,
      multiple: bet ? r.amount / bet : null,
      at: r.createdAt,
    };
  });
}

// everything the backoffice needs about one player, composed from the ledger
async function playerDetail(id, days) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const user = await User.findById(id)
    .select("username profilePicture level xp walletBalance isAdmin weeklyWinnings referredBy inventory")
    .lean();
  if (!user) return null;

  const since = sinceFor(days);
  const uid = user._id;
  const [byTypeDirRows, bjHandsRows, recent, referrals, referrer] = await Promise.all([
    Transaction.aggregate([
      { $match: { userId: uid, ...matchSince(since) } },
      {
        $group: {
          _id: { type: "$type", direction: "$direction" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
          max: { $max: "$amount" },
          qty: { $sum: { $ifNull: ["$meta.quantity", 0] } },
          last: { $max: "$createdAt" },
        },
      },
    ]),
    Transaction.aggregate([
      { $match: { userId: uid, ...blackjackHandsMatch(since) } },
      { $count: "n" },
    ]),
    // _id breaks the tie: ledger writes land in the same millisecond often enough that
    // sorting on createdAt alone leaves the newest rows in an arbitrary order. objectids
    // climb with insertion, so this is the order they were actually written in.
    Transaction.find({ userId: uid })
      .sort({ createdAt: -1, _id: -1 })
      .limit(15)
      .select("type direction amount balanceAfter createdAt")
      .lean(),
    User.countDocuments({ referredBy: uid }),
    user.referredBy ? User.findById(user.referredBy).select("username").lean() : null,
  ]);

  const slots = new Map(byTypeDirRows.map((r) => [`${r._id.type}:${r._id.direction}`, r]));
  const get = (type, direction) => slots.get(`${type}:${direction}`) || { total: 0, count: 0, max: 0, qty: 0 };

  const blackjackHands = bjHandsRows[0] ? bjHandsRows[0].n : 0;
  const games = GAME_LINES.map(({ game, bets, outs }) => {
    const bet = get(bets[0], "debit");
    const won = outs.reduce((s, o) => s + get(o, "credit").total, 0);
    const plays =
      game === "cases" ? bet.qty || bet.count
      : game === "blackjack" ? blackjackHands
      : bet.count;
    return { game, plays, wagered: bet.total, won, net: bet.total - won };
  }).filter((g) => g.plays > 0);

  const wagered = games.reduce((s, g) => s + g.wagered, 0);
  const won = games.reduce((s, g) => s + g.won, 0);
  const faucet = FAUCET_TYPES.reduce((s, t) => s + get(t, "credit").total, 0);
  const biggestWin = WIN_TYPES.reduce(
    (best, t) => {
      const m = get(t, "credit");
      return m.max > best.amount ? { type: t, amount: m.max } : best;
    },
    { type: null, amount: 0 }
  );
  const lastActive = byTypeDirRows.reduce((d, r) => (!d || r.last > d ? r.last : d), null);

  return {
    user: {
      id: String(uid),
      username: user.username,
      profilePicture: user.profilePicture || "",
      level: user.level || 0,
      xp: user.xp || 0,
      walletBalance: user.walletBalance,
      isAdmin: !!user.isAdmin,
      weeklyWinnings: user.weeklyWinnings || 0,
      joined: uid.getTimestamp(),
      inventoryCount: (user.inventory || []).length,
      referredBy: referrer ? referrer.username : null,
      referrals,
    },
    totals: {
      wagered,
      won,
      net: wagered - won,
      faucet,
      marketSpent: get(TX.MARKET_BUY, "debit").total,
      marketEarned: get(TX.MARKET_SALE, "credit").total,
      itemsSold: get(TX.ITEM_SELL, "credit").total,
      biggestWin,
      lastActive,
    },
    games,
    recent,
  };
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SORTS = { newest: { _id: -1 }, balance: { walletBalance: -1 }, level: { level: -1 } };

async function userStats({ days, page = 1, search = "", sort = "newest" } = {}) {
  const since = sinceFor(days);
  const filter = search ? { username: { $regex: escapeRegex(String(search)), $options: "i" } } : {};
  const p = Math.max(1, Math.floor(Number(page)) || 1);

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter, { username: 1, profilePicture: 1, level: 1, walletBalance: 1, isAdmin: 1, referredBy: 1 })
      .sort(SORTS[sort] || SORTS.newest)
      .skip((p - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
  ]);

  const ids = users.map((u) => u._id);
  const [activity, referrers] = await Promise.all([
    Transaction.aggregate([
      { $match: { userId: { $in: ids }, ...matchSince(since) } },
      {
        $group: {
          _id: "$userId",
          wagered: { $sum: { $cond: [{ $in: ["$type", STAKE_TYPES] }, "$amount", 0] } },
          lastActive: { $max: "$createdAt" },
        },
      },
    ]),
    User.find({ _id: { $in: users.map((u) => u.referredBy).filter(Boolean) } }, { username: 1 }).lean(),
  ]);
  const act = new Map(activity.map((a) => [String(a._id), a]));
  const refName = new Map(referrers.map((r) => [String(r._id), r.username]));

  return {
    total,
    page: p,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    users: users.map((u) => {
      const a = act.get(String(u._id)) || {};
      return {
        id: String(u._id),
        username: u.username,
        profilePicture: u.profilePicture || "",
        level: u.level || 0,
        walletBalance: u.walletBalance,
        isAdmin: !!u.isAdmin,
        joined: u._id.getTimestamp(),
        wagered: a.wagered || 0,
        lastActive: a.lastActive || null,
        referredBy: u.referredBy ? refName.get(String(u.referredBy)) || null : null,
      };
    }),
  };
}

module.exports = { overview, gameStats, caseStats, userStats, timeseries, bigWins, playerDetail, PAGE_SIZE };
