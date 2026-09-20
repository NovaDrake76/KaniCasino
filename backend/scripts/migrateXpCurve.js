const User = require("../models/User");
const Migration = require("../models/Migration");
const { xpForLevel, oldXpForLevel, oldLevelFromXp } = require("../utils/xpCurve");

const NAME = "xp-curve-2026-09";

// moves every account's xp onto the new ladder at the same level and the same way into it, so nobody
// opens the site to find their level gone. runs once, at boot, before anything can bet
const carriedXp = (stored, xp) => {
  // the stored level, or the one the old ladder gives the xp if a bet slipped in first and lowered it
  const level = Math.max(stored || 0, oldLevelFromXp(xp));
  const lo = oldXpForLevel(level);
  const hi = oldXpForLevel(level + 1);
  const frac = hi > lo ? Math.max(0, Math.min(1, ((xp || 0) - lo) / (hi - lo))) : 0;
  return Math.floor(xpForLevel(level) + frac * (xpForLevel(level + 1) - xpForLevel(level)));
};

async function migrateXpCurve({ dry = false } = {}) {
  if (await Migration.exists({ name: NAME })) return { ran: false };
  const cursor = User.find({}, { level: 1, xp: 1 }).lean().cursor();
  let ops = [];
  let touched = 0;
  const flush = async () => {
    if (ops.length && !dry) await User.bulkWrite(ops, { ordered: false });
    touched += ops.length;
    ops = [];
  };
  for await (const u of cursor) {
    ops.push({ updateOne: { filter: { _id: u._id }, update: { $set: { xp: carriedXp(u.level || 0, u.xp) } } } });
    if (ops.length >= 500) await flush();
  }
  await flush();
  if (!dry) await Migration.create({ name: NAME, touched });
  return { ran: true, touched };
}

module.exports = { migrateXpCurve, carriedXp, NAME };

if (require.main === module) {
  require("dotenv").config();
  const mongoose = require("mongoose");
  const dry = process.argv.includes("--dry");
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => migrateXpCurve({ dry }))
    .then((r) => console.log(dry ? "dry run:" : "done:", r))
    .finally(() => mongoose.disconnect());
}
