const User = require("../models/User");
const MissionState = require("../models/MissionState");
const { CATALOG } = require("./missionsCatalog");

const TOP_FAN = "topFan";
const CONTRIBUTOR = "contributor";
const CONNECTED = "connected";

// what an admin may hand out. everything else is earned by playing, and handing one of
// those over would let the backoffice fake a standing the sweep is about to overwrite.
const GRANTABLE = [CONTRIBUTOR];
const KEYS = [TOP_FAN, CONTRIBUTOR, CONNECTED];

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

// every social mission claimed earns the connected badge. checked on the claim itself, so
// nothing has to sweep for it.
async function awardConnected(userId) {
  if (!SOCIAL_KEYS.length) return false;
  const state = await MissionState.findOne({ userId }).select("claimed").lean();
  const claimed = new Set((state && state.claimed) || []);
  if (!SOCIAL_KEYS.every((key) => claimed.has(key))) return false;

  const res = await User.updateOne(
    { _id: userId, "badges.key": { $ne: CONNECTED } },
    { $push: { badges: { key: CONNECTED, awardedAt: new Date() } } }
  );
  return res.modifiedCount === 1;
}

async function grant(userId, key, note) {
  if (!GRANTABLE.includes(key)) return { ok: false, message: "That badge is earned, not granted" };
  const res = await User.updateOne(
    { _id: userId, "badges.key": { $ne: key } },
    { $push: { badges: { key, awardedAt: new Date(), note: (note || "").slice(0, 120) } } }
  );
  return { ok: true, changed: res.modifiedCount === 1 };
}

async function revoke(userId, key) {
  if (!GRANTABLE.includes(key)) return { ok: false, message: "That badge is earned, not granted" };
  const res = await User.updateOne({ _id: userId }, { $pull: { badges: { key } } });
  // a player wearing a badge they no longer hold would show nothing anyway, but clearing
  // the choice keeps the stored state honest
  await User.updateOne({ _id: userId, selectedBadge: key }, { $unset: { selectedBadge: "" } });
  return { ok: true, changed: res.modifiedCount === 1 };
}

module.exports = { TOP_FAN, CONTRIBUTOR, CONNECTED, KEYS, GRANTABLE, SOCIAL_KEYS, heldBadges, wornBadge, awardConnected, grant, revoke };
