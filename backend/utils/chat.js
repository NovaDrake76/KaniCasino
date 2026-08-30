const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const realtime = require("./realtime");
const badges = require("./badges");

// the site chat. it is moderated by rules rather than by people, because there is nobody to
// watch it: a level gate turns away throwaway accounts, links are refused outright, and one
// message per window stops a flood. everything here is cheap on purpose.
const ENABLED = () => process.env.CHAT_ENABLED !== "false";

// a level gate is the whole anti-spam story. reaching it costs real play, which is far more
// expensive than making another account, so the usual drive-by never gets to type.
const MIN_LEVEL = Number(process.env.CHAT_MIN_LEVEL || 2);
const MAX_LENGTH = 200;
const PER_USER_MS = 3000;
// what a new joiner is handed. history is the point: an empty box on load is what makes a
// quiet chat look dead, and dead is worse than absent.
const KEEP = 50;

const lastSent = new Map();

// no links, at all. an allowlist is a judgement call every time and there is nobody to make
// it; a flat refusal is one rule that a player can understand and cannot argue with.
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|gg|io|xyz|ru|co|me|link|shop)\b)/i;
const INVITE = /(discord\.(gg|com\/invite)|t\.me\/|telegram\.me)/i;

const CARD = "username slug profilePicture level fanRank selectedBadge badges disabled";

const clean = (text) =>
  String(text || "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// the shape the client renders, and the only shape that ever leaves here
const wire = (doc) => ({
  id: String(doc._id),
  userId: String(doc.userId),
  username: doc.username,
  slug: doc.slug || null,
  profilePicture: doc.profilePicture || null,
  level: doc.level || 0,
  badge: doc.badge || null,
  text: doc.text,
  at: new Date(doc.at).getTime(),
});

function validate(text) {
  const body = clean(text);
  if (!body) return { error: "empty" };
  if (body.length > MAX_LENGTH) return { error: "tooLong" };
  if (INVITE.test(body) || LINK.test(body)) return { error: "noLinks" };
  return { body };
}

// one lookup per message, on a projection that never touches the inventory. the author card
// is then written onto the row, so reading the history back costs no user reads at all.
async function send(userId, text) {
  if (!ENABLED()) return { error: "off" };
  if (!userId) return { error: "auth" };

  const checked = validate(text);
  if (checked.error) return checked;

  const now = Date.now();
  if (now - (lastSent.get(String(userId)) || 0) < PER_USER_MS) return { error: "slowDown" };

  const user = await User.findById(userId).select(CARD).lean();
  if (!user) return { error: "auth" };
  if (user.disabled) return { error: "banned" };
  if ((user.level || 0) < MIN_LEVEL) return { error: "level", minLevel: MIN_LEVEL };

  // set after the checks, so a refused message does not spend the player's window
  lastSent.set(String(userId), now);

  const doc = await ChatMessage.create({
    userId,
    username: user.username,
    slug: user.slug || null,
    profilePicture: user.profilePicture || null,
    level: user.level || 0,
    badge: badges.wornBadge(user) || null,
    text: checked.body,
    at: new Date(now),
  });

  const message = wire(doc);
  const io = realtime.getIo();
  if (io) io.emit("chat:message", message);
  return { message };
}

// natural order on a capped collection is insertion order, which is what $natural reads,
// and it needs no index and no sort stage
async function recent(limit = KEEP) {
  if (!ENABLED()) return [];
  const rows = await ChatMessage.find({})
    .sort({ $natural: -1 })
    .limit(Math.min(limit, KEEP))
    .lean();
  return rows.reverse().map(wire);
}

// an admin taking a message down. the row goes for everyone, since there is no one to
// review a hidden queue later.
async function remove(messageId) {
  const doc = await ChatMessage.findById(messageId).lean();
  if (!doc) return { error: "gone" };
  await ChatMessage.deleteOne({ _id: messageId });
  const io = realtime.getIo();
  if (io) io.emit("chat:removed", { id: String(messageId) });
  return { ok: true };
}

// reports go to a discord webhook rather than into a queue nobody opens: the person who
// would moderate this is already in discord, and a report that is not seen is not a report.
const REPORT_PER_USER_MS = 60000;
const lastReport = new Map();

async function report(userId, messageId, reason) {
  if (!userId) return { error: "auth" };
  const now = Date.now();
  if (now - (lastReport.get(String(userId)) || 0) < REPORT_PER_USER_MS) return { error: "slowDown" };

  const doc = await ChatMessage.findById(messageId).lean();
  if (!doc) return { error: "gone" };
  lastReport.set(String(userId), now);

  const hook = process.env.CHAT_REPORT_WEBHOOK;
  if (!hook) {
    console.log(`chat report: ${doc.username} said "${doc.text}" (${messageId})`);
    return { ok: true };
  }
  try {
    await fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `Reported chat message \`${messageId}\`
**${doc.username}**: ${clean(doc.text).slice(0, 300)}
reason: ${clean(reason).slice(0, 120) || "none given"}`,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    // a webhook that is down must not fail the report for the player who sent it
    console.error("chat report webhook:", err.message);
  }
  return { ok: true };
}

const reset = () => {
  lastSent.clear();
  lastReport.clear();
};

module.exports = { send, recent, remove, report, validate, wire, reset, ENABLED, MIN_LEVEL, MAX_LENGTH, PER_USER_MS, KEEP };
