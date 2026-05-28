const User = require("../models/User");

const BASE_XP = 1000; // xp required for the first level
const GROWTH_RATE = 1.25; // growth rate for each level

function calculateXPForLevel(level) {
  return Math.floor(BASE_XP * Math.pow(GROWTH_RATE, level - 1));
}

// level is fully derived from xp, so this is idempotent and safe to recompute
function calculateLevelFromXp(xp) {
  let level = 0;
  while (xp >= calculateXPForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

// atomically debit `cost` only if the balance covers it, optionally granting xp.
// returns the updated user, or null when funds are insufficient.
async function chargeUser(userId, cost, { awardXp = true } = {}) {
  const inc = awardXp
    ? { walletBalance: -cost, xp: cost * 5 }
    : { walletBalance: -cost };

  const user = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: cost } },
    { $inc: inc },
    { new: true }
  );

  if (!user) {
    return null;
  }

  if (awardXp) {
    const newLevel = calculateLevelFromXp(user.xp);
    if (newLevel !== user.level) {
      user.level = newLevel;
      await User.updateOne({ _id: userId }, { $set: { level: newLevel } });
    }
  }

  return user;
}

// atomically credit winnings to the wallet (and weekly winnings).
async function creditUser(userId, amount, winnings = 0) {
  return User.findByIdAndUpdate(
    userId,
    { $inc: { walletBalance: amount, weeklyWinnings: winnings } },
    { new: true }
  );
}

module.exports = {
  calculateXPForLevel,
  calculateLevelFromXp,
  chargeUser,
  creditUser,
};
