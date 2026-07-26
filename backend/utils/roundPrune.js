const Round = require("../models/Round");

// crash and coinflip run around the clock whether or not anyone is playing, and each
// round is a document. 99.5% of them never took a bet, so they are pure disk.
// the window keeps enough settled rounds for the history strips to stay full.
const KEEP_HOURS = 24;

async function pruneEmptyRounds({ keepHours = KEEP_HOURS } = {}) {
  const before = new Date(Date.now() - keepHours * 3600 * 1000);
  const res = await Round.deleteMany({
    createdAt: { $lt: before },
    status: { $in: ["settled", "voided"] },
    $or: [{ bets: { $size: 0 } }, { bets: { $exists: false } }],
  });
  return res.deletedCount || 0;
}

module.exports = { pruneEmptyRounds, KEEP_HOURS };
