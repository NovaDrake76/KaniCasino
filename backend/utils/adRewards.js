const { v4: uuidv4 } = require("uuid");
const AdWatch = require("../models/AdWatch");
const Transaction = require("../models/Transaction");
const { creditUser, runAtomic, TX } = require("./economy");
const { isRealMoneyMode } = require("./mode");

const AD_REWARD_AMOUNT = 500;
const AD_REWARD_DAILY_CAP = 10;
// a claim younger than this cannot have played a real video; env override for tests
const minWatchMs = () => Number(process.env.AD_REWARD_MIN_WATCH_MS || 5000);
// which player the frontend should use; "adsense" once h5 games ads is approved
const provider = () => process.env.AD_REWARDS_PROVIDER || "mock";

// paying users KP for ad views only makes sense while the KP is play money
const adRewardsEnabled = () => !isRealMoneyMode();

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// rows already paid today; the ledger is the counter, nothing to drift
const paidToday = (userId) =>
  Transaction.countDocuments({ userId, type: TX.AD_REWARD, createdAt: { $gte: startOfToday() } });

async function getStatus(userId) {
  if (!adRewardsEnabled()) return { enabled: false };
  const paid = await paidToday(userId);
  return {
    enabled: true,
    provider: provider(),
    amount: AD_REWARD_AMOUNT,
    dailyCap: AD_REWARD_DAILY_CAP,
    remainingToday: Math.max(0, AD_REWARD_DAILY_CAP - paid),
  };
}

// issue a one-time watch token. tokens issued today count against the cap too, so
// hoarding players does not stack claims; under parallel starts the count check is
// best-effort, which for a capped fake-coin faucet is exposure enough.
async function startWatch(userId) {
  if (!adRewardsEnabled()) return { code: 403, body: { message: "Ad rewards are disabled" } };
  const [issuedToday, alreadyPaid] = await Promise.all([
    AdWatch.countDocuments({ userId, createdAt: { $gte: startOfToday() } }),
    paidToday(userId),
  ]);
  if (issuedToday >= AD_REWARD_DAILY_CAP || alreadyPaid >= AD_REWARD_DAILY_CAP) {
    return { code: 429, body: { message: "No more rewarded ads today, come back tomorrow" } };
  }
  const watch = await AdWatch.create({ userId, token: uuidv4() });
  return { code: 200, body: { token: watch.token, amount: AD_REWARD_AMOUNT, minWatchMs: minWatchMs() } };
}

// redeem a token exactly once, only after a plausible watch time, only under the cap
async function claimWatch(userId, token) {
  if (!adRewardsEnabled()) return { code: 403, body: { message: "Ad rewards are disabled" } };
  if (await paidToday(userId) >= AD_REWARD_DAILY_CAP) {
    return { code: 429, body: { message: "No more rewarded ads today, come back tomorrow" } };
  }

  // the claim filter is the mutex and it commits in one transaction with the credit,
  // so a failed payout frees the token instead of burning it. too fast, already
  // claimed or foreign tokens match nothing.
  let credited;
  try {
    credited = await runAtomic(async (session) => {
      const watch = await AdWatch.findOneAndUpdate(
        {
          token: String(token || ""),
          userId,
          claimedAt: null,
          createdAt: { $lte: new Date(Date.now() - minWatchMs()) },
        },
        { $set: { claimedAt: new Date() } },
        { session }
      );
      if (!watch) return null;
      const paid = await creditUser(userId, AD_REWARD_AMOUNT, 0, {
        type: TX.AD_REWARD,
        meta: { provider: provider(), watchToken: watch.token },
        session,
      });
      if (!paid) throw new Error("ad reward credit failed"); // abort, the token frees
      return paid;
    });
  } catch (e) {
    console.error("claimWatch failed:", e);
    return { code: 500, body: { message: "Could not pay the reward, please try again" } };
  }
  if (credited === null) return { code: 400, body: { message: "Invalid or unfinished ad view" } };

  const paid = await paidToday(userId);
  return {
    code: 200,
    body: {
      claimed: AD_REWARD_AMOUNT,
      walletBalance: credited.walletBalance,
      remainingToday: Math.max(0, AD_REWARD_DAILY_CAP - paid),
      user: credited,
    },
  };
}

module.exports = {
  AD_REWARD_AMOUNT,
  AD_REWARD_DAILY_CAP,
  adRewardsEnabled,
  getStatus,
  startWatch,
  claimWatch,
};
