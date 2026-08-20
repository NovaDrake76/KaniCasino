const User = require("../models/User");
const MissionState = require("../models/MissionState");
const Notification = require("../models/Notification");
const { CATALOG } = require("./missionsCatalog");

const TOP_FAN = "topFan";
const CONTRIBUTOR = "contributor";
const CONNECTED = "connected";

// what an admin may hand out. everything else is earned by playing, and handing one of
// those over would let the backoffice fake a standing the sweep is about to overwrite.
const GRANTABLE = [CONTRIBUTOR];
const KEYS = [TOP_FAN, CONTRIBUTOR, CONNECTED];

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
    if (!KEYS.includes(badge.key) || badge.key === TOP_FAN) continue;
    held.push({ key: badge.key, awardedAt: badge.awardedAt || null, note: badge.note || null });
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
async function notifyBadge(userId, key, io) {
  const content = `You earned the ${TITLES[key] || key} badge. Pick it on your profile to wear it.`;
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
async function award(userId, key, io, note) {
  const badge = { key, awardedAt: new Date() };
  if (note) badge.note = String(note).slice(0, 120);
  const res = await User.updateOne(
    { _id: userId, "badges.key": { $ne: key } },
    { $push: { badges: badge } }
  );
  if (res.modifiedCount !== 1) return false;
  await notifyBadge(userId, key, io);
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
  CONNECTED,
  KEYS,
  GRANTABLE,
  SOCIAL_KEYS,
  heldBadges,
  wornBadge,
  awardConnected,
  sweepConnected,
  grant,
  revoke,
};
