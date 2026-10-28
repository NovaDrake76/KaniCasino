const crypto = require("crypto");
const Coupon = require("../models/Coupon");
const { creditUser, runAtomic, TX } = require("./economy");
const { getIo } = require("./realtime");
const limits = require("./limits");
const verification = require("./verification");

// no ambiguous glyphs, the same alphabet as the discord link codes: these get read off a phone. 32 divides 256, so no letter is likelier
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
// one list of who redeemed lives on each coupon, so the cap is also what bounds that list
const MAX_REDEMPTIONS = 1000;
const MAX_AMOUNT = 100000;
const MAX_MINUTES = 30 * 24 * 60;

const envNumber = (name, fallback) => (process.env[name] !== undefined && process.env[name] !== "" ? Number(process.env[name]) : fallback);

// what the bot's daily drop pays is set here, never by the bot, so a leaked bot secret can only drop what this allows
const dropTerms = () => ({
  amount: envNumber("COUPON_DROP_AMOUNT", 500),
  maxRedemptions: envNumber("COUPON_DROP_MAX", 25),
  minutes: envNumber("COUPON_DROP_MINUTES", 60),
  perDay: envNumber("COUPON_DROPS_PER_DAY", 1),
});

const makeCode = () => Array.from(crypto.randomBytes(CODE_LENGTH), (byte) => ALPHABET[byte % ALPHABET.length]).join("");

// typed by hand, so case, spaces and dashes are forgiven
const normalize = (raw) => String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);

const isWhole = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;

const summary = (c) => ({
  id: String(c._id),
  code: c.code,
  amount: c.amount,
  redeemed: c.redeemed,
  maxRedemptions: c.maxRedemptions,
  expiresAt: c.expiresAt,
  disabledAt: c.disabledAt || null,
  source: c.source,
  createdAt: c.createdAt,
});

async function create({ amount, maxRedemptions, minutes, code, source, createdBy = null, slot, now = new Date() }) {
  if (!isWhole(amount, 1, MAX_AMOUNT) || !isWhole(maxRedemptions, 1, MAX_REDEMPTIONS) || !isWhole(minutes, 1, MAX_MINUTES)) {
    return { code: 400, body: { message: "Amount, redemptions and minutes must be whole numbers in range" } };
  }
  const chosen = code ? normalize(code) : makeCode();
  if (chosen.length < 4) return { code: 400, body: { message: "A code needs at least 4 letters or digits" } };
  try {
    const doc = await Coupon.create({
      code: chosen,
      amount,
      maxRedemptions,
      expiresAt: new Date(now.getTime() + minutes * 60000),
      source,
      createdBy,
      ...(slot ? { slot } : {}),
    });
    return { code: 201, body: summary(doc) };
  } catch (e) {
    if (e && e.code === 11000) return { code: 409, body: { message: slot ? "Today's drop is already out" : "That code is taken", reason: slot ? "dropped" : "taken" } };
    throw e;
  }
}

// the bot's drop: the terms above, a random code, and at most perDay of them each utc day
async function drop(now = new Date()) {
  const terms = dropTerms();
  if (!(terms.perDay > 0)) return { code: 409, body: { message: "Drops are switched off", reason: "off" } };
  const day = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
  const today = await Coupon.countDocuments({ source: "discord", createdAt: { $gte: day } });
  if (today >= terms.perDay) return { code: 409, body: { message: "Today's drop is already out", reason: "dropped" } };
  const slot = `discord:${day.toISOString().slice(0, 10)}:${today + 1}`;
  return create({ amount: terms.amount, maxRedemptions: terms.maxRedemptions, minutes: terms.minutes, source: "discord", slot, now });
}

const refuse = (status, reason, message) => ({ code: status, body: { message, reason } });

// why a redemption found nothing to take, in the order a player would want to hear it
async function whyNot(code, userId, now) {
  const doc = await Coupon.findOne({ code }, { redeemed: 1, maxRedemptions: 1, expiresAt: 1, disabledAt: 1 }).lean();
  if (!doc) return refuse(404, "unknown", "That code does not exist");
  if (await Coupon.exists({ _id: doc._id, redeemedBy: userId })) return refuse(409, "already", "You already redeemed that code");
  if (doc.disabledAt) return refuse(410, "off", "That code was switched off");
  if (doc.expiresAt <= now) return refuse(410, "expired", "That code has expired");
  if (doc.redeemed >= doc.maxRedemptions) return refuse(410, "usedUp", "That code has been fully redeemed");
  return refuse(409, "retry", "Could not redeem the code, please try again");
}

// the same accounts the rain pays. the claim and its record are one write on the coupon, guarded in the filter,
// and the credit rides the same transaction, so a failed payout gives the redemption back
async function redeem(user, raw, now = new Date()) {
  const code = normalize(raw);
  if (!code) return refuse(404, "unknown", "That code does not exist");
  const locked = limits.lockFor(user) || verification.lockFor(user, now);
  if (locked) return { code: 403, body: locked };

  let result;
  try {
    result = await runAtomic(async (session) => {
      const taken = await Coupon.findOneAndUpdate(
        {
          code,
          disabledAt: null,
          expiresAt: { $gt: now },
          redeemedBy: { $ne: user._id },
          $expr: { $lt: ["$redeemed", "$maxRedemptions"] },
        },
        { $inc: { redeemed: 1 }, $push: { redeemedBy: user._id } },
        { new: true, projection: { code: 1, amount: 1 }, session }
      );
      if (!taken) return null;
      const paid = await creditUser(user._id, taken.amount, 0, { type: TX.COUPON, meta: { code: taken.code, couponId: taken._id }, session });
      if (!paid) throw new Error("coupon credit failed");
      return { amount: taken.amount, paid };
    });
  } catch (e) {
    console.error("coupon redeem failed:", e);
    return refuse(500, "retry", "Could not redeem the code, please try again");
  }
  if (!result) return whyNot(code, user._id, now);

  const io = getIo();
  if (io) {
    io.to(String(user._id)).emit("userDataUpdated", { walletBalance: result.paid.walletBalance, xp: result.paid.xp, level: result.paid.level });
  }
  return { code: 200, body: { redeemed: true, amount: result.amount, walletBalance: result.paid.walletBalance } };
}

const recent = async (limit = 50) => (await Coupon.find({}, { redeemedBy: 0 }).sort({ createdAt: -1 }).limit(limit).lean()).map(summary);

async function disable(id, now = new Date()) {
  const doc = await Coupon.findOneAndUpdate({ _id: id, disabledAt: null }, { $set: { disabledAt: now } }, { new: true, projection: { redeemedBy: 0 } }).lean();
  if (!doc) return { code: 404, body: { message: "No live coupon with that id" } };
  return { code: 200, body: summary(doc) };
}

module.exports = { ALPHABET, CODE_LENGTH, normalize, dropTerms, create, drop, redeem, recent, disable };
