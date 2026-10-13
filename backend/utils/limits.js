const mongoose = require("mongoose");
const User = require("../models/User");
const IpSighting = require("../models/IpSighting");
const memo = require("./memo");
const realtime = require("./realtime");
const verification = require("./verification");

const REASON_MAX = 300;
const IDS_TTL_MS = 60 * 1000;
// a phone network can put hundreds of players behind one address, so a shared address lists the latest few
const SHARED_SHOWN = 25;

const isLimited = (user) => !!(user && user.limited && user.limited.at);

// the 403 a limited account's market writes, shop buys and claims answer with
const lockFor = (user) => (isLimited(user) ? { message: "Your account is limited", reason: "limited" } : null);

// what the player is told about their own account
const statusOf = (user) => (isLimited(user) ? { at: user.limited.at, reason: user.limited.reason || "" } : null);

// every limited account, for the leaderboard to leave out. a handful at most, read once a minute
const limitedIds = () =>
  memo.remember("limits:ids", IDS_TTL_MS, async () =>
    (await User.find({ "limited.at": { $exists: true } }, { _id: 1 }).lean()).map((u) => u._id)
  );

const validId = (id) => mongoose.Types.ObjectId.isValid(String(id));

async function usernames(ids) {
  const wanted = [...new Set(ids.filter(Boolean).map(String))];
  if (!wanted.length) return new Map();
  const rows = await User.find({ _id: { $in: wanted } }, { username: 1 }).lean();
  return new Map(rows.map((u) => [String(u._id), u.username]));
}

const describe = (limited, names) =>
  limited && limited.at
    ? {
        at: limited.at,
        reason: limited.reason || "",
        by: limited.by ? { id: String(limited.by), username: names.get(String(limited.by)) || null } : null,
      }
    : null;

// the player's banner, the board and every cached copy that counted them change together
function changed(userId) {
  memo.forget("limits:");
  memo.forget("leaderboard:");
  const io = realtime.getIo();
  if (io) io.to(String(userId)).emit("accountUpdated");
}

async function limit(userId, { by, reason }) {
  if (!validId(userId)) return { code: 404, body: { message: "User not found" } };
  const text = String(reason || "").trim().slice(0, REASON_MAX);
  if (!text) return { code: 400, body: { message: "Write the reason the player will see" } };
  if (String(userId) === String(by)) return { code: 400, body: { message: "You cannot limit your own account" } };
  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $set: { limited: { at: new Date(), by, reason: text } } },
    { new: true, projection: { limited: 1 } }
  ).lean();
  if (!user) return { code: 404, body: { message: "User not found" } };
  changed(userId);
  return { code: 200, body: { limited: describe(user.limited, await usernames([by])) } };
}

async function lift(userId) {
  if (!validId(userId)) return { code: 404, body: { message: "User not found" } };
  const user = await User.findOneAndUpdate({ _id: userId }, { $unset: { limited: "" } }, { projection: { limited: 1 } }).lean();
  if (!user) return { code: 404, body: { message: "User not found" } };
  if (isLimited(user)) {
    changed(userId);
    // what the limit held back is paid now, in both directions of the referral
    await require("./referrals").settleAfterLift(userId);
  }
  return { code: 200, body: { limited: null } };
}

// the limited accounts, newest first, for the backoffice list
async function list() {
  const users = await User.find({ "limited.at": { $exists: true } }, { username: 1, level: 1, limited: 1 })
    .sort({ "limited.at": -1 })
    .limit(200)
    .lean();
  const names = await usernames(users.map((u) => u.limited.by));
  return users.map((u) => ({ id: String(u._id), username: u.username, level: u.level || 0, limited: describe(u.limited, names) }));
}

// the other accounts seen on this account's addresses. a lead to weigh, not proof: a household, a school or a phone
// network can put many people behind one address
async function sharedAccounts(userId) {
  const mine = await IpSighting.find({ userId }, { ipHash: 1, lastAt: 1 }).sort({ lastAt: -1 }).limit(50).lean();
  if (!mine.length) return { addresses: 0, shared: [] };
  const others = await IpSighting.find(
    { ipHash: { $in: mine.map((m) => m.ipHash) }, userId: { $ne: userId } },
    { ipHash: 1, userId: 1, lastAt: 1 }
  )
    .sort({ lastAt: -1 })
    .limit(500)
    .lean();
  const ids = [...new Set(others.map((o) => String(o.userId)))];
  const users = ids.length
    ? await User.find({ _id: { $in: ids } }, { username: 1, level: 1, disabled: 1, "limited.at": 1, ...verification.VERIFIED_FIELDS }).lean()
    : [];
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const shared = mine
    .map((m) => {
      const rows = others.filter((o) => o.ipHash === m.ipHash && byId.has(String(o.userId)));
      if (!rows.length) return null;
      return {
        hash: m.ipHash.slice(0, 8),
        lastAt: m.lastAt,
        accounts: rows.slice(0, SHARED_SHOWN).map((o) => {
          const u = byId.get(String(o.userId));
          return {
            id: String(u._id),
            username: u.username,
            level: u.level || 0,
            verified: verification.isVerified(u),
            limited: isLimited(u),
            disabled: !!u.disabled,
            lastAt: o.lastAt,
          };
        }),
        more: Math.max(0, rows.length - SHARED_SHOWN),
      };
    })
    .filter(Boolean);
  return { addresses: mine.length, shared };
}

// everything the backoffice shows about an account's standing
async function accountFor(userId) {
  if (!validId(userId)) return null;
  const user = await User.findById(userId, { email: 1, disabled: 1, limited: 1, ...verification.VERIFIED_FIELDS }).lean();
  if (!user) return null;
  const names = await usernames([user.limited && user.limited.by]);
  return {
    verification: { verified: verification.isVerified(user), via: verification.verifiedVia(user), email: user.email || null },
    limited: describe(user.limited, names),
    disabled: !!user.disabled,
    ...(await sharedAccounts(user._id)),
  };
}

module.exports = { isLimited, lockFor, statusOf, limitedIds, limit, lift, list, accountFor, sharedAccounts, REASON_MAX };
