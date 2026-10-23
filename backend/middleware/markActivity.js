const activity = require("../utils/activity");

// any action a player takes counts as being there for daisu's "still there?" (utils/stillThere.js). reads, the take, its answer
// and the usage batches never do: a tab left open sends those on its own
const NOT_ACTIVITY = /^\/(daisu\/(claim|still-there)|usage)(\/|$)/;

function markActivity(req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS" && !NOT_ACTIVITY.test(req.path)) {
    res.on("finish", () => req.user && res.statusCode < 400 && activity.mark(req.user._id));
  }
  next();
}

module.exports = { markActivity };
