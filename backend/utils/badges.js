const User = require("../models/User");
const MissionState = require("../models/MissionState");
const Notification = require("../models/Notification");
const Case = require("../models/Case");
const itemCatalog = require("./itemCatalog");
const { CATALOG } = require("./missionsCatalog");

const TOP_FAN = "topFan";
const CONTRIBUTOR = "contributor";
const CONNECTED = "connected";

// what an admin may hand out. everything else is earned by playing, and handing one of
// those over would let the backoffice fake a standing the sweep is about to overwrite.
const GRANTABLE = [CONTRIBUTOR];
const KEYS = [TOP_FAN, CONTRIBUTOR, CONNECTED];
// one badge per case category, keyed off a slug of its name so a new category earns one
// without a code change
const COLLECTION = "collection:";
const isCollection = (key) => typeof key === "string" && key.startsWith(COLLECTION);
const slugify = (category) =>
  String(category).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// stored notifications are english everywhere else in the codebase, so these are too
const TITLES = { [CONTRIBUTOR]: "Contributor", [CONNECTED]: "Connected" };

const SOCIAL_KEYS = CATALOG.filter((m) => m.metric === "social" && m.active !== false).map((m) => m.key);

// top fan is derived from the fandom sweep rather than stored, because it can be taken
// off a player the moment someone outcollects them. the rest are earned once and kept.
function heldBadges(user) {
  if (!user) return [];
  const held = [];
  if (user.fanRank && user.fanRank.rank === 1) {
    held.push({
      key: TOP_FAN,
      awardedAt: null,
      fandom: {
        name: user.fanRank.name,
        image: user.fanRank.image,
        rarity: user.fanRank.rarity,
        count: user.fanRank.count,
        fans: user.fanRank.fans,
      },
    });
  }
  for (const badge of user.badges || []) {
    if (badge.key === TOP_FAN) continue;
    if (!KEYS.includes(badge.key) && !isCollection(badge.key)) continue;
    held.push({
      key: badge.key,
      awardedAt: badge.awardedAt || null,
      note: badge.note || null,
      label: badge.label || null,
    });
  }
  return held;
}

// the one badge the player chose to wear around the site. a selection they no longer hold
// shows nothing rather than lingering as a badge they lost.
function wornBadge(user) {
  if (!user || !user.selectedBadge) return null;
  return heldBadges(user).find((badge) => badge.key === user.selectedBadge) || null;
}

// a badge lands silently otherwise: it sits on the profile with nothing telling the
// player it arrived. the socket emit is optional, the stored row is not.
async function notifyBadge(userId, key, io, label) {
  const name = label || TITLES[key] || key;
  const content = `You earned the ${name} badge. Pick it on your profile to wear it.`;
  await Notification.create({
    senderId: userId,
    receiverId: userId,
    type: "alert",
    title: "New badge",
    content,
  });
  if (io) io.to(String(userId)).emit("newNotification", { message: content });
}

// the filter is the mutex: a badge already held is not pushed twice, and only a real
// award notifies
async function award(userId, key, io, note, label) {
  const badge = { key, awardedAt: new Date() };
  if (note) badge.note = String(note).slice(0, 120);
  if (label) badge.label = String(label).slice(0, 60);
  const res = await User.updateOne(
    { _id: userId, "badges.key": { $ne: key } },
    { $push: { badges: badge } }
  );
  if (res.modifiedCount !== 1) return false;
  await notifyBadge(userId, key, io, label);
  return true;
}

// every social mission claimed earns the connected badge. checked on the claim itself, so
// a player who has just finished the set gets it immediately.
async function awardConnected(userId, io) {
  if (!SOCIAL_KEYS.length) return false;
  const state = await MissionState.findOne({ userId }).select("claimed").lean();
  const claimed = new Set((state && state.claimed) || []);
  if (!SOCIAL_KEYS.every((key) => claimed.has(key))) return false;
  return award(userId, CONNECTED, io);
}

// the claim hook only fires for a claim made from now on, so this catches everyone who
// finished the social missions before the badge existed, and anyone the hook missed
async function sweepConnected(io) {
  if (!SOCIAL_KEYS.length) return 0;
  const states = await MissionState.find({ claimed: { $all: SOCIAL_KEYS } })
    .select("userId")
    .lean();
  let awarded = 0;
  for (const state of states) {
    if (await award(state.userId, CONNECTED, io)) awarded += 1;
  }
  return awarded;
}

// every case category and the item ids that make it whole. a category is complete only
// when the player owns one of every distinct item across all of its collectible cases;
// a case marked `collectible: false` is on the shelf but out of the set.
//
// Case.items is raw admin input and can still name an item that has since been deleted.
// those never drop and nobody can hold one, so counting them asks for a set that cannot
// be completed: the touhou badge wanted 137 of the 134 that exist. only live items count.
async function collectionSets() {
  const [cases, catalog] = await Promise.all([
    Case.find({}, { category: 1, items: 1, collectible: 1 }).lean(),
    itemCatalog.all(),
  ]);
  const live = new Set(catalog.map((item) => String(item._id)));
  const byCategory = new Map();
  for (const one of cases) {
    if (one.collectible === false) continue;
    const label = (one.category || "").trim();
    if (!label) continue;
    const slug = slugify(label);
    if (!slug) continue;
    if (!byCategory.has(slug)) byCategory.set(slug, { slug, label, ids: new Set() });
    for (const id of one.items || []) {
      if (live.has(String(id))) byCategory.get(slug).ids.add(String(id));
    }
  }
  return [...byCategory.values()].filter((c) => c.ids.size > 0);
}

// completing a collection is kept for good: selling something afterwards does not take it
// back, so nobody has to be afraid to trade once they have it.
async function sweepCollections(io) {
  const sets = await collectionSets();
  if (!sets.length) return 0;
  const smallest = Math.min(...sets.map((c) => c.ids.size));

  // an inventory shorter than the smallest collection cannot complete anything, which
  // skips most accounts before their items are ever read
  // inventory-read: the sweep asks whether a whole collection is held, one account at a time
  const cursor = User.find({ $expr: { $gte: [{ $size: { $ifNull: ["$inventory", []] } }, smallest] } })
    .select("inventory badges")
    .lean()
    .cursor();

  let awarded = 0;
  for await (const user of cursor) {
    const owned = new Set();
    for (const entry of user.inventory || []) if (entry && entry._id) owned.add(String(entry._id));
    const has = new Set((user.badges || []).map((b) => b.key));
    for (const set of sets) {
      const key = COLLECTION + set.slug;
      if (has.has(key) || owned.size < set.ids.size) continue;
      let whole = true;
      for (const id of set.ids) {
        if (!owned.has(id)) { whole = false; break; }
      }
      if (whole && (await award(user._id, key, io, null, set.label))) awarded += 1;
    }
  }
  return awarded;
}

// what exists to be earned, for the "all badges" list. the collection ones come from the
// live categories rather than a hardcoded set.
async function catalog() {
  const sets = await collectionSets();
  return [
    ...KEYS.map((key) => ({ key, label: null })),
    ...sets.map((set) => ({ key: COLLECTION + set.slug, label: set.label, size: set.ids.size })),
  ];
}

async function grant(userId, key, note, io) {
  if (!GRANTABLE.includes(key)) return { ok: false, message: "That badge is earned, not granted" };
  return { ok: true, changed: await award(userId, key, io, note) };
}

async function revoke(userId, key) {
  if (!GRANTABLE.includes(key)) return { ok: false, message: "That badge is earned, not granted" };
  const res = await User.updateOne({ _id: userId }, { $pull: { badges: { key } } });
  // a player wearing a badge they no longer hold would show nothing anyway, but clearing
  // the choice keeps the stored state honest
  await User.updateOne({ _id: userId, selectedBadge: key }, { $unset: { selectedBadge: "" } });
  return { ok: true, changed: res.modifiedCount === 1 };
}

module.exports = {
  TOP_FAN,
  CONTRIBUTOR,
  CONNECTED,  KEYS,
  GRANTABLE,
  COLLECTION,
  isCollection,
  slugify,
  collectionSets,
  sweepCollections,
  catalog,
  SOCIAL_KEYS,
  heldBadges,
  wornBadge,
  awardConnected,
  sweepConnected,  grant,
  revoke,
};
