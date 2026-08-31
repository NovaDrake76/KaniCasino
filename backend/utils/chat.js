const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const realtime = require("./realtime");
const badges = require("./badges");
const nameFilter = require("./nameFilter");
const profanity = require("./profanity");

// the site chat. it is moderated by rules rather than by people, because there is nobody to
// watch it: a level gate turns away throwaway accounts, links are refused outright, and one
// message per window stops a flood. everything here is cheap on purpose.
const ENABLED = () => process.env.CHAT_ENABLED !== "false";

// a level gate is the whole anti-spam story. reaching it costs real play, which is far more
// expensive than making another account, so the usual drive-by never gets to type.
//
// xp is five times the stake, so a level costs floor(1000 * 1.25^(level-1)) / 5 KP wagered.
// level 2 is 250 KP, which a signup's own 200 plus one bonus claim covers in a minute: that
// is not a gate. level 5 is about 490 KP, enough that a throwaway has to actually sit and
// play, and low enough that a real new player is talking within their first session.
const MIN_LEVEL = Number(process.env.CHAT_MIN_LEVEL || 5);
const MAX_LENGTH = 200;
const PER_USER_MS = 3000;
// what a new joiner is handed. history is the point: an empty box on load is what makes a
// quiet chat look dead, and dead is worse than absent.
const KEEP = 50;

const lastSent = new Map();

// somebody who has just had a slur refused will try three more spellings. a refusal is
// cheap for them and free for us, so after a few in a row the box goes quiet for a while
// rather than becoming a puzzle to solve.
const STRIKES_BEFORE_MUTE = 3;
const MUTE_MS = 10 * 60 * 1000;
const strikes = new Map();
const mutedUntil = new Map();

function strike(userId) {
  const key = String(userId);
  const count = (strikes.get(key) || 0) + 1;
  strikes.set(key, count);
  if (count >= STRIKES_BEFORE_MUTE) {
    strikes.delete(key);
    mutedUntil.set(key, Date.now() + MUTE_MS);
  }
}

// no links, at all. an allowlist is a judgement call every time and there is nobody to
// make it; a flat refusal is one rule that a player can understand and cannot argue with.
//
// the plain patterns were walked straight past by "https: //sex(.)com". a dot written as
// (.) or [.] or " dot " is still a dot, a space after the protocol is still a protocol,
// and a zero width character between two letters is not a word boundary. everything is
// folded down to one shape before the patterns run.
const INVISIBLE = /[​-‏⁠﻿­͏]/g;

const linkShape = (text) =>
  String(text)
    .toLowerCase()
    .replace(INVISIBLE, "")
    // every way somebody writes a dot without typing one
    .replace(/\s*[([{<]\s*[.,]\s*[)\]}>]\s*/g, ".")
    .replace(/\s+(?:dot|ponto|punto|d0t)\s+/g, ".")
    .replace(/\s*\[\s*(?:dot|ponto)\s*\]\s*/g, ".")
    // and the space people put in to break the pattern up
    .replace(/(https?|ftp)\s*:\s*\/*/g, "$1://")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s*(?:\/|slash)\s*\//g, "//");

// chasing each spacing trick one at a time is a losing game: "h t t p s://x.co" walked past
// a rule written for "https : //". the patterns are run against the text with every space
// taken out as well, which covers the whole family at once. an ordinary sentence squashed
// down still needs a real tld after a dot to trip anything, so "3.5x on crash" is safe.
const despaced = (text) => linkShape(text).replace(/\s+/g, "");

// a bare domain needs a real tld, or "3.5x on crash" is a link
const TLD =
  "com|net|org|gg|io|xyz|ru|co|me|link|shop|club|site|online|store|info|biz|tv|app|dev|br|pt|es|uk|de|fr|it|nl|pl|top|vip|win|bet|cc|to|ly|gl|be|us";
// String.raw, or the template literal eats the backslashes before the regex sees them
const LINK = new RegExp(
  String.raw`(https?://|ftp://|www\.|\b[a-z0-9-]{2,}\.(?:${TLD})\b)`,
  "i"
);
const INVITE = /(discord\.(gg|com\/invite)|discordapp\.com\/invite|t\.me\/|telegram\.me|chat\.whatsapp)/i;

const CARD = "username slug profilePicture level fanRank selectedBadge badges disabled";

const clean = (text) =>
  String(text || "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// the shape the client renders, and the only shape that ever leaves here
const wire = (doc) => ({
  id: String(doc._id),
  // _id as well as userId: the row is handed straight to the Player component, which
  // links and draws the avatar off _id. without it every name pointed at /profile/undefined.
  _id: String(doc.userId),
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

  for (const shape of [linkShape(body), despaced(body)]) {
    if (INVITE.test(shape) || LINK.test(shape)) return { error: "noLinks" };
  }

  // the same matcher the username filter uses, which already tolerates leetspeak,
  // separators, repeats, fullwidth forms and cyrillic lookalikes
  if (!nameFilter.isClean(body)) return { error: "slur" };

  // swearing is a lesser thing than a slur and is matched differently, on whole words, so
  // that "class" and "cute" are still sentences a player can type
  if (!profanity.isClean(body)) return { error: "language" };

  return { body };
}

// one lookup per message, on a projection that never touches the inventory. the author card
// is then written onto the row, so reading the history back costs no user reads at all.
async function send(userId, text) {
  if (!ENABLED()) return { error: "off" };
  if (!userId) return { error: "auth" };

  const checked = validate(text);
  if (checked.error) {
    // only the deliberate ones count. a typo or a rate limit is not an attempt at anything.
    if (["slur", "noLinks", "language"].includes(checked.error)) strike(userId);
    return checked;
  }

  const now = Date.now();
  if ((mutedUntil.get(String(userId)) || 0) > now) return { error: "muted" };
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
  strikes.clear();
  mutedUntil.clear();
};

module.exports = { send, recent, remove, report, validate, linkShape, despaced, wire, reset, ENABLED, MIN_LEVEL, MAX_LENGTH, PER_USER_MS, KEEP, STRIKES_BEFORE_MUTE, MUTE_MS };
