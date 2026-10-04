const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const EmailToken = require("../models/EmailToken");
const emailCheck = require("./emailCheck");
const { sendMail } = require("./mailer");
const verifyEmail = require("./emails/verifyEmail");
const { resolvePassword } = require("./password");

// the leaderboard, the market and rain need a verified account from this moment on; until then they only warn.
// it matches the board's midnight in brazil, so no day is cut in half.
const requiredFrom = () => new Date(process.env.VERIFY_REQUIRED_FROM || "2026-10-11T03:00:00Z");
const enforced = (at = new Date()) => new Date(at).getTime() >= requiredFrom().getTime();

const present = (v) => v !== undefined && v !== null && v !== "";

// google proved the address, discord holds one account per person, or the player clicked the link we mailed
function verifiedVia(user) {
  if (!user) return null;
  if (present(user.googleId)) return "google";
  if (present(user.emailVerifiedAt)) return "email";
  if (present(user.discordId)) return "discord";
  return null;
}
const isVerified = (user) => verifiedVia(user) !== null;

// the same rule as a mongo filter, with the path prefix a lookup puts the user under
const verifiedFilter = (prefix = "") => ({
  $or: [
    { [`${prefix}googleId`]: { $nin: [null, ""] } },
    { [`${prefix}emailVerifiedAt`]: { $ne: null } },
    { [`${prefix}discordId`]: { $nin: [null, ""] } },
  ],
});
const VERIFIED_FIELDS = { googleId: 1, emailVerifiedAt: 1, discordId: 1 };

// the 403 a gated action answers with. nothing before the lock date, and nothing for a verified account.
const lockFor = (user, at = new Date()) =>
  isVerified(user) || !enforced(at) ? null : { message: "This needs a verified account", reason: "verify", from: requiredFrom() };

// what the client is told about its own account
const statusOf = (user) => ({
  verified: isVerified(user),
  via: verifiedVia(user),
  email: (user && user.email) || null,
  // a google account's address belongs to google, and changing it here would cut it off from google sign-in
  canChangeEmail: !!user && !present(user.googleId),
  requiredFrom: requiredFrom(),
  enforced: enforced(),
});

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const DAILY_SENDS = 5;
const hash = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const looksLikeEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;

// spends one of today's sends, or says no. the counter sits on the account and the check is in the filter, so two
// clicks at once cannot both get through.
async function takeSend(userId) {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const res = await User.updateOne(
    {
      _id: userId,
      $or: [
        { "verifyMail.day": { $ne: day } },
        { "verifyMail.sent": { $lt: DAILY_SENDS }, "verifyMail.lastAt": { $lte: new Date(now.getTime() - COOLDOWN_MS) } },
      ],
    },
    [
      {
        $set: {
          verifyMail: {
            day,
            sent: { $cond: [{ $eq: ["$verifyMail.day", day] }, { $add: [{ $ifNull: ["$verifyMail.sent", 0] }, 1] }, 1] },
            lastAt: now,
          },
        },
      },
    ]
  );
  return res.modifiedCount === 1;
}

// why this address cannot prove this account, or null. one inbox proves one account, however its address is spelled.
async function problemWith(user, email) {
  const shape = await emailCheck.verifyProblem(email);
  if (shape) return shape;
  const box = emailCheck.mailbox(email);
  const taken = await User.exists({
    _id: { $ne: user._id },
    $or: [{ verifiedMailbox: box }, { googleId: { $nin: [null, ""] }, email: emailCheck.mailboxPattern(box) }],
  });
  return taken ? { reason: "taken" } : null;
}

const MESSAGES = {
  invalid: "That is not an email address",
  noMailServer: "That address cannot receive email",
  disposable: "Throwaway inboxes cannot verify an account. Use your own address.",
  taken: "That inbox already verified another account",
  inUse: "Another account uses that address",
  same: "That is already your address",
  google: "Accounts that sign in with Google keep their Google address",
  password: "Wrong password",
  bounced: "Email to this address bounced. Change it to one that works.",
  tooSoon: "Wait a minute before asking again, and at most five times a day",
  expired: "That link has expired or was already used. Ask for a new one.",
};
const fail = (code, reason, extra = {}) => ({ code, body: { reason, message: MESSAGES[reason], ...extra } });

const MAIL_FIELDS = "username email password googleId discordId emailVerifiedAt unsubscribeToken marketingOptIn emailSuppressed";

// the link goes to `email` with this account's name on it; only the hash of the token is stored
async function sendLink(user, email, lang) {
  const token = crypto.randomBytes(32).toString("base64url");
  await EmailToken.deleteMany({ userId: user._id });
  await EmailToken.create({ userId: user._id, email, tokenHash: hash(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) });
  const mail = verifyEmail.build({ name: user.username, token, lang });
  return sendMail({ to: email, ...mail, kind: "service", user });
}

// a link to the account's own address
async function requestVerification(userId, lang) {
  const user = await User.findById(userId).select(MAIL_FIELDS);
  if (!user) return { code: 404, body: { message: "User not found" } };
  if (present(user.googleId) || present(user.emailVerifiedAt)) return { code: 200, body: { alreadyVerified: true } };
  if (!user.email) return fail(400, "invalid");
  if (user.emailSuppressed) return fail(400, "bounced");
  const problem = await problemWith(user, user.email);
  if (problem) return fail(400, problem.reason, { suggestion: problem.suggestion || null });
  if (!(await takeSend(user._id))) return fail(429, "tooSoon");
  const sent = await sendLink(user, user.email, lang);
  return { code: 200, body: { sent: !!sent.sent, to: user.email } };
}

// a move to a new address: nothing changes until the link sent there is clicked, so a typo cannot lock anyone out
// and nobody can claim an address they cannot read
async function requestEmailChange(userId, { email, password, lang }) {
  const user = await User.findById(userId).select(MAIL_FIELDS);
  if (!user) return { code: 404, body: { message: "User not found" } };
  if (present(user.googleId)) return fail(400, "google");
  const next = String(email || "").trim();
  if (!looksLikeEmail(next)) return fail(400, "invalid");
  if (next.toLowerCase() === String(user.email || "").toLowerCase()) return fail(400, "same");
  if (user.password && !(await bcrypt.compare(resolvePassword(String(password || "")), user.password))) return fail(400, "password");
  const escaped = next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (await User.exists({ _id: { $ne: user._id }, email: new RegExp(`^${escaped}$`, "i") })) return fail(409, "inUse");
  const problem = await problemWith(user, next);
  if (problem) return fail(400, problem.reason, { suggestion: problem.suggestion || null });
  if (!(await takeSend(user._id))) return fail(429, "tooSoon");
  const sent = await sendLink(user, next, lang);
  return { code: 200, body: { sent: !!sent.sent, to: next } };
}

// a clicked link. it proves the address, moves the account to it when it was a change, and pays what was waiting
// on the account being verified. no session needed: the link is often opened on another device.
async function confirm(token) {
  const row = await EmailToken.findOne({ tokenHash: hash(token || "") });
  if (!row || row.expiresAt <= new Date()) return fail(400, "expired");
  const user = await User.findById(row.userId).select(MAIL_FIELDS);
  if (!user) return fail(400, "expired");
  // another account may have verified this inbox while the link sat in it
  const problem = await problemWith(user, row.email);
  if (problem) {
    await EmailToken.deleteOne({ _id: row._id });
    return fail(400, problem.reason);
  }
  const changing = row.email.toLowerCase() !== String(user.email || "").toLowerCase();
  const update = { $set: { email: row.email, emailVerifiedAt: new Date(), verifiedMailbox: emailCheck.mailbox(row.email) } };
  // a bounce flag belongs to the old address, not to the one just proved
  if (changing) {
    update.$set.emailSuppressed = false;
    update.$unset = { emailSuppressedReason: "", emailSuppressedAt: "" };
  }
  try {
    await User.updateOne({ _id: user._id }, update);
  } catch (err) {
    if (err && err.code === 11000) return fail(409, err.keyPattern && err.keyPattern.email ? "inUse" : "taken");
    throw err;
  }
  await EmailToken.deleteMany({ userId: user._id });
  await onVerified(user._id);
  return { code: 200, body: { verified: true, email: row.email } };
}

// whatever waited on this account being verified. today that is its referrer's bonuses.
async function onVerified(userId) {
  try {
    await require("./referrals").settleOnVerified(userId);
  } catch (err) {
    console.error("on verified:", err.message);
  }
}

module.exports = {
  requiredFrom,
  enforced,
  verifiedVia,
  isVerified,
  verifiedFilter,
  VERIFIED_FIELDS,
  lockFor,
  statusOf,
  requestVerification,
  requestEmailChange,
  confirm,
  onVerified,
  DAILY_SENDS,
};
