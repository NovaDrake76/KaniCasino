// closing, resolving and voiding a market. paying out is a loop over every position, and a
// loop that dies halfway must not pay anybody twice when it comes back: the lease says who
// owns the loop and the settled flag on each position says who has already been paid.

const Prediction = require("../models/Prediction");
const PredictionPosition = require("../models/PredictionPosition");
const PredictionSettlement = require("../models/PredictionSettlement");
const Notification = require("../models/Notification");
const { creditUser, TX } = require("../utils/economy");
const { ONE } = require("./predictionMath");

// a share wins a whole KP, which is the entire point of the one KP ceiling on a price
const PAYOUT_PER_SHARE = 1;
// a lease older than this belonged to a process that is not coming back
const LEASE_STALE_MS = 5 * 60 * 1000;
const BATCH = 100;

const bad = (error) => ({ error });

// stop taking trades without saying what happened yet. an admin closes a market by hand,
// and the cron closes anything whose clock has run out.
async function closeMarket(predictionId) {
  const closed = await Prediction.findOneAndUpdate(
    { _id: predictionId, status: "open" },
    { $set: { status: "closed" } },
    { new: true }
  );
  return closed ? { ok: true, prediction: closed } : bad("That market is not open");
}

async function reopenMarket(predictionId) {
  const open = await Prediction.findOneAndUpdate(
    { _id: predictionId, status: "closed" },
    { $set: { status: "open" } },
    { new: true }
  );
  return open ? { ok: true, prediction: open } : bad("That market is not closed");
}

// claim the right to run this settlement. the unique index on predictionId is the lock:
// a second caller finds the row already there and is told to leave it alone, unless the
// process holding it died, in which case the lease is old enough to take.
async function claimLease(predictionId, kind, outcomeKey) {
  const now = new Date();
  const stale = new Date(now.getTime() - LEASE_STALE_MS);
  const taken = await PredictionSettlement.findOneAndUpdate(
    {
      predictionId,
      $or: [{ status: "running", lockedAt: { $lt: stale } }, { status: "failed" }],
    },
    { $set: { status: "running", lockedAt: now, kind, outcomeKey } },
    { new: true }
  );
  if (taken) return taken;

  try {
    return await PredictionSettlement.create({ predictionId, kind, outcomeKey, lockedAt: now, startedAt: now });
  } catch (err) {
    return null; // somebody else holds it and is still alive
  }
}

// pay one position and mark it paid in the same write. the filter on settled is what makes
// a resumed run safe: a position already paid matches nothing and is simply skipped.
async function payPosition(position, amount, prediction, kind) {
  const claimed = await PredictionPosition.findOneAndUpdate(
    { _id: position._id, settled: false },
    { $set: { settled: true, settledAt: new Date(), payout: amount } },
    { new: false }
  );
  if (!claimed) return 0;
  if (amount <= 0) return 0;

  const meta = {
    predictionId: String(prediction._id),
    slug: prediction.slug,
    title: prediction.title,
    outcome: position.outcomeKey,
    shares: position.shares,
  };
  // a refund is money coming back, not winnings, so it stays off the weekly leaderboard
  const isVoid = kind === "void";
  const credited = await creditUser(position.userId, amount, isVoid ? 0 : amount, {
    type: isVoid ? TX.PREDICTION_REFUND : TX.PREDICTION_PAYOUT,
    meta,
  });
  if (!credited) {
    // hand the position back rather than swallowing somebody's winnings
    await PredictionPosition.updateOne({ _id: position._id }, { $set: { settled: false, payout: 0 } });
    throw new Error("prediction payout could not be credited");
  }
  return amount;
}

// what a position is owed. a resolution pays the winning outcome a KP a share and everyone
// else nothing; a void gives back what was spent, whichever way the prices had moved.
const owedFor = (position, kind, winningKey) => {
  if (kind === "void") return Math.max(0, position.spent);
  return position.outcomeKey === winningKey ? position.shares * PAYOUT_PER_SHARE : 0;
};

async function runSettlement(prediction, kind, winningKey, io) {
  // resolving twice is not an error, it is a retry: with nothing left owing there is
  // nothing to claim and nothing to pay
  const owing = await PredictionPosition.countDocuments({ predictionId: prediction._id, settled: false });
  if (owing === 0) return { ok: true, paidPositions: 0, totalPaid: 0 };

  const lease = await claimLease(prediction._id, kind, winningKey);
  if (!lease) return bad("That market is already being settled");

  let paidPositions = 0;
  let totalPaid = 0;
  const winners = new Map();

  try {
    for (;;) {
      const batch = await PredictionPosition.find({ predictionId: prediction._id, settled: false }).limit(BATCH);
      if (batch.length === 0) break;

      for (const position of batch) {
        const amount = owedFor(position, kind, winningKey);
        const paid = await payPosition(position, amount, prediction, kind);
        if (paid > 0) {
          paidPositions += 1;
          totalPaid += paid;
          winners.set(String(position.userId), (winners.get(String(position.userId)) || 0) + paid);
        }
      }
      // the lease is held for as long as the loop is making progress
      await PredictionSettlement.updateOne({ _id: lease._id }, { $set: { lockedAt: new Date() } });
    }
  } catch (err) {
    console.error("prediction settlement failed", String(prediction._id), err);
    await PredictionSettlement.updateOne({ _id: lease._id }, { $set: { status: "failed" } });
    return bad("The payout could not be finished, it will be retried");
  }

  await PredictionSettlement.updateOne(
    { _id: lease._id },
    { $set: { status: "done", finishedAt: new Date() }, $inc: { paidPositions, totalPaid } }
  );

  await tellWinners(prediction, kind, winners, io);
  return { ok: true, paidPositions, totalPaid };
}

async function tellWinners(prediction, kind, winners, io) {
  if (winners.size === 0) return;
  const title = kind === "void" ? "Market cancelled" : "Market resolved";
  const rows = [...winners.entries()].map(([userId, amount]) => ({
    receiverId: userId,
    type: "alert",
    title,
    content:
      kind === "void"
        ? `${prediction.title} was cancelled and your ${amount} KP was returned.`
        : `You won ${amount} KP on ${prediction.title}.`,
  }));
  await Notification.insertMany(rows).catch(() => {});
  if (!io) return;
  for (const row of rows) {
    io.to(String(row.receiverId)).emit("newNotification", { message: row.content });
    io.to(String(row.receiverId)).emit("userDataUpdated");
  }
}

// say which outcome happened and pay for it. the market is stamped resolved before the
// payout runs, so a crash mid-loop leaves a market nobody can trade and a sweep can finish.
async function resolveMarket({ predictionId, outcomeKey, adminId, note, io }) {
  const prediction = await Prediction.findById(predictionId);
  if (!prediction) return bad("That market does not exist");
  if (prediction.status === "void") return bad("That market was cancelled");
  if (!prediction.outcomes.some((o) => o.key === outcomeKey)) return bad("No such outcome");

  if (prediction.status !== "resolved") {
    await Prediction.updateOne(
      { _id: prediction._id },
      { $set: { status: "resolved", resolvedOutcome: outcomeKey, resolvedAt: new Date(), resolvedBy: adminId, resolutionNote: note || "" } }
    );
    prediction.status = "resolved";
    prediction.resolvedOutcome = outcomeKey;
  } else if (prediction.resolvedOutcome !== outcomeKey) {
    return bad("That market was already resolved to a different outcome");
  }

  return runSettlement(prediction, "resolve", outcomeKey, io);
}

// the market cannot be called, so everybody gets back what they spent net of what they
// already sold. it costs the house whatever the vig had earned, which is the right price
// for having opened a market that could not be settled.
async function voidMarket({ predictionId, adminId, note, io }) {
  const prediction = await Prediction.findById(predictionId);
  if (!prediction) return bad("That market does not exist");
  if (prediction.status === "resolved") return bad("That market was already resolved");

  if (prediction.status !== "void") {
    await Prediction.updateOne(
      { _id: prediction._id },
      { $set: { status: "void", resolvedAt: new Date(), resolvedBy: adminId, resolutionNote: note || "" } }
    );
    prediction.status = "void";
  }

  return runSettlement(prediction, "void", null, io);
}

// on boot, and every so often after: finish anything that was interrupted mid-payout
async function sweepSettlements(io) {
  const stuck = await Prediction.find({
    status: { $in: ["resolved", "void"] },
  }).select("_id status resolvedOutcome slug title").lean();

  let resumed = 0;
  for (const row of stuck) {
    const unpaid = await PredictionPosition.countDocuments({ predictionId: row._id, settled: false });
    if (unpaid === 0) continue;
    const result = row.status === "void"
      ? await runSettlement(row, "void", null, io)
      : await runSettlement(row, "resolve", row.resolvedOutcome, io);
    if (result.ok) resumed += 1;
  }
  return resumed;
}

// anything whose clock has run out stops taking trades on its own
async function closeExpired() {
  const { modifiedCount } = await Prediction.updateMany(
    { status: "open", endsAt: { $ne: null, $lte: new Date() } },
    { $set: { status: "closed" } }
  );
  return modifiedCount || 0;
}

module.exports = {
  closeMarket,
  reopenMarket,
  resolveMarket,
  voidMarket,
  sweepSettlements,
  closeExpired,
  owedFor,
  PAYOUT_PER_SHARE,
  LEASE_STALE_MS,
  ONE,
};
