const mongoose = require("mongoose");
const User = require("../models/User");
const Case = require("../models/Case");
const Transaction = require("../models/Transaction");
const { accountBalance, ledgerSupply, TX, STAKE_TYPES } = require("./economy");
const { HOUSE, MINT, ESCROW } = require("./accounts");

const PAGE_SIZE = 20;

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
  { game: "cases", bets: [TX.CASE_OPEN], outs: [] },
  { game: "battles", bets: [TX.BATTLE_ENTRY], outs: [TX.BATTLE_REFUND] },
];

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

  const games = GAME_LINES.map(({ game, bets, outs }) => {
    const betSlot = byTypeDir[`${bets[0]}:debit`] || { amount: 0, count: 0, qty: 0 };
    const plays = game === "cases" ? betSlot.qty || betSlot.count : betSlot.count;
    const wagered = sumOf(bets, "debit");
    const paidOut = sumOf(outs, "credit");
    return { game, plays, wagered, paidOut, net: wagered - paidOut };
  }).sort((a, b) => b.net - a.net);

  // everything else settling against the house or the mint, signed from the house's
  // and the supply's point of view; grouped by type so new lines appear on their own
  const gameTypes = new Set(GAME_LINES.flatMap((g) => [...g.bets, ...g.outs]));
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

module.exports = { overview, gameStats, caseStats, userStats, PAGE_SIZE };
