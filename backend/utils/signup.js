const jwt = require("jsonwebtoken");
const User = require("../models/User");
const nameFilter = require("./nameFilter");
const { slugify } = require("./slugs");

// the rules a nickname has to clear, in one place, because two routes create accounts and
// they were free to disagree. the google side used to take whatever google supplied.
//
// the bounds are deliberately wide. there was no length rule at all before this, so a
// narrow one would turn names people can register today into errors: two characters is a
// perfectly ordinary japanese or chinese name, and thirty is only there to stop a name
// that breaks every table it appears in.
const MIN_NAME = 2;
const MAX_NAME = 30;

// letters, digits, and the three separators a nickname reasonably wants. anything else is
// either a slug problem or somebody dressing a slur up in punctuation.
const NAME_SHAPE = /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u;

// returns a message when the name cannot be used, or null when its shape is fine. this is
// the part that needs no database, so the client can run exactly the same check.
function nameProblem(raw) {
  const name = String(raw || "").trim();
  if (name.length < MIN_NAME) return "tooShort";
  if (name.length > MAX_NAME) return "tooLong";
  if (!NAME_SHAPE.test(name)) return "badCharacters";
  if (nameFilter.findSlur(name)) return "notAllowed";
  return null;
}

// "Shiki" and "shiki" reduce to the same url, so the second is refused rather than being
// handed a suffix forever. names and urls an account has worn before count as taken too,
// or the next holder inherits the chat lines still signed with them.
async function nameTaken(name, ignoreId) {
  const slug = slugify(name);
  const or = [{ username: name }, { pastNames: name }];
  if (slug) or.push({ slug }, { pastSlugs: slug });
  const query = { $or: or };
  if (ignoreId) query._id = { $ne: ignoreId };
  return User.exists(query);
}

// one change a month. a name people are still learning is worth more than the freedom to
// hop between them mid-conversation.
const RENAME_COOLDOWN_DAYS = 30;
const RENAME_COOLDOWN_MS = RENAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

// when the next change is allowed, or null when it is allowed now
function renameAllowedAt(changedAt) {
  if (!changedAt) return null;
  const next = new Date(new Date(changedAt).getTime() + RENAME_COOLDOWN_MS);
  return next > new Date() ? next : null;
}

// what to put in the box when google is the one signing them up. their google name if it is
// usable and free, otherwise a numbered variant, and they can replace it with anything.
async function suggestName(googleName, googleSub) {
  const base = nameFilter.safeUsername(googleName, googleSub);
  if (!nameProblem(base) && !(await nameTaken(base))) return base;

  const stem = String(base || "player").slice(0, MAX_NAME - 4);
  for (let i = 0; i < 8; i++) {
    const candidate = `${stem}${Math.floor(Math.random() * 10000)}`;
    if (!nameProblem(candidate) && !(await nameTaken(candidate))) return candidate;
  }
  return `player${Date.now().toString().slice(-6)}`;
}

// a google sign-in that finds no account no longer creates one on the spot. it hands back
// this ticket instead, and the account is made when the player has chosen their name and
// picture. it is signed, so nobody can post an arbitrary email at the finishing route, and
// it is short lived, because it is a step in a form rather than a session.
const TICKET_TTL = "15m";

const issueTicket = (payload) =>
  jwt.sign({ ...payload, use: "google-signup" }, process.env.JWT_SECRET, { expiresIn: TICKET_TTL });

// returns the google identity the ticket carries, or null when it is expired, forged, or a
// token minted for something else entirely
function readTicket(ticket) {
  try {
    const claim = jwt.verify(String(ticket || ""), process.env.JWT_SECRET);
    if (claim.use !== "google-signup" || !claim.sub || !claim.email) return null;
    return { sub: claim.sub, email: claim.email, name: claim.name, picture: claim.picture };
  } catch {
    return null;
  }
}

module.exports = {
  MIN_NAME,
  MAX_NAME,
  NAME_SHAPE,
  RENAME_COOLDOWN_DAYS,
  nameProblem,
  nameTaken,
  renameAllowedAt,
  suggestName,
  issueTicket,
  readTicket,
};
