// the trade path. everything that moves a price or a balance goes through here, so the
// quote a player is shown and the fill they get come out of the same call.

const Prediction = require("../models/Prediction");
const PredictionPosition = require("../models/PredictionPosition");
const PredictionTrade = require("../models/PredictionTrade");
const PredictionPricepoint = require("../models/PredictionPricepoint");
const User = require("../models/User");
const { chargeUser, creditUser, TX } = require("./economy");
const { preview, ONE } = require("./predictionMath");

const MAX_SHARES = 1000000;
// how many times a trade will re-quote after losing the race for the book. it has to be
// comfortably above the number of people plausibly trading one market at the same instant,
// or the last one in the queue gets turned away for being unlucky rather than wrong.
const CAS_ATTEMPTS = 12;

// losers back off before re-reading, jittered, so they do not all collide again
const backoff = (attempt) =>
  new Promise((done) => setTimeout(done, attempt * 4 + Math.floor(Math.random() * 8)));

const bad = (error) => ({ error });

// the market as the trade panel reads it: prices, what is held, what it would cost
function publicView(prediction, positions = []) {
  const held = new Map(positions.map((p) => [p.outcomeKey, p]));
  return {
    _id: prediction._id,
    slug: prediction.slug,
    title: prediction.title,
    description: prediction.description,
    image: prediction.image,
    category: prediction.category,
    status: prediction.status,
    endsAt: prediction.endsAt,
    volume: prediction.volume,
    traders: prediction.traders,
    vigBps: prediction.vigBps,
    resolvedOutcome: prediction.resolvedOutcome,
    resolutionNote: prediction.resolutionNote,
    resolvedAt: prediction.resolvedAt,
    outcomes: prediction.outcomes.map((o) => {
      const pos = held.get(o.key);
      return {
        key: o.key,
        label: o.label,
        image: o.image,
        priceBps: o.priceBps,
        volume: o.volume,
        shares: pos ? pos.shares : 0,
        avgPriceBps: pos && pos.shares > 0 ? Math.round(pos.costBps / pos.shares) : 0,
        spent: pos ? pos.spent : 0,
      };
    }),
  };
}

// a market only takes trades while it is open and before its clock runs out
function tradable(prediction) {
  if (!prediction) return "That market does not exist";
  if (prediction.status !== "open") return "That market is closed";
  if (prediction.endsAt && prediction.endsAt.getTime() <= Date.now()) return "That market has ended";
  return null;
}

// price a trade without touching anything. the panel calls this on every keystroke.
function quote(prediction, outcomeKey, action, shares) {
  const closed = tradable(prediction);
  if (closed) return bad(closed);
  if (!Number.isInteger(shares) || shares <= 0) return bad("Shares must be a whole number above zero");
  if (shares > MAX_SHARES) return bad("That is more shares than this market will take");

  const index = prediction.outcomes.findIndex((o) => o.key === outcomeKey);
  if (index < 0) return bad("No such outcome");

  const q = preview({
    prices: prediction.outcomes.map((o) => o.priceBps),
    index,
    shares,
    action,
    impactBps: prediction.impactBps,
    vigBps: prediction.vigBps,
  });
  if (q.error) return q;
  return { ...q, index, outcomeKey };
}

// what the house would owe if this outcome came true, against what it is willing to owe
const overCap = (prediction, index, addedShares) =>
  prediction.outcomes[index].shares + addedShares > prediction.exposureCap;

// swap the whole book in one write, but only if nobody moved it since it was read. the
// filter on seq is the serialization point for a market: two traders reading the same
// prices cannot both write their answer, so the loser re-reads and re-quotes.
async function commitPrices(prediction, index, nextPrices, sharesDelta, amount) {
  const set = {};
  nextPrices.forEach((price, i) => { set["outcomes." + i + ".priceBps"] = price; });
  return Prediction.findOneAndUpdate(
    { _id: prediction._id, seq: prediction.seq, status: "open" },
    {
      $set: set,
      $inc: {
        seq: 1,
        volume: amount,
        ["outcomes." + index + ".shares"]: sharesDelta,
        ["outcomes." + index + ".volume"]: amount,
      },
    },
    { new: true }
  );
}

// put the book back after a fill that could not be paid for. it can only fail if somebody
// traded in the sliver between the two writes, and then the book is still internally
// consistent, just carrying a move for a trade that did not happen: strictly better than
// charging for one that did not happen either.
async function revertPrices(prediction, committed, index, sharesDelta, amount) {
  const set = {};
  prediction.outcomes.forEach((o, i) => { set["outcomes." + i + ".priceBps"] = o.priceBps; });
  const undone = await Prediction.findOneAndUpdate(
    { _id: prediction._id, seq: committed.seq },
    {
      $set: set,
      $inc: {
        seq: 1,
        volume: -amount,
        ["outcomes." + index + ".shares"]: -sharesDelta,
        ["outcomes." + index + ".volume"]: -amount,
      },
    }
  );
  if (!undone) console.error("prediction price revert lost a race", String(prediction._id), committed.seq);
}

async function recordTrade(prediction, userId, q, action, amount) {
  const at = new Date();
  const row = await PredictionTrade.create({
    userId,
    predictionId: prediction._id,
    outcomeKey: q.outcomeKey,
    action,
    shares: q.shares,
    avgPriceBps: q.avgBps,
    amount,
    priceBeforeBps: q.startBps,
    priceAfterBps: q.prices[q.index],
  });
  // every line on the chart moves when one outcome does, so every line gets a point
  await PredictionPricepoint.insertMany(
    prediction.outcomes.map((o, i) => ({
      predictionId: prediction._id,
      outcomeKey: o.key,
      priceBps: q.prices[i],
      at,
    }))
  );
  return row;
}

async function buy({ userId, prediction, q }) {
  // the seq filter below serializes the market, so an exposure read from this book is the
  // exposure the fill lands on: a trade that slipped in first makes the commit fail
  if (overCap(prediction, q.index, q.shares)) {
    return bad("This market has taken all it can on that outcome");
  }

  const committed = await commitPrices(prediction, q.index, q.prices, q.shares, q.amount);
  if (!committed) return null; // the book moved, the caller re-quotes

  const meta = tradeMeta(prediction, q);
  const charged = await chargeUser(userId, q.amount, { type: TX.PREDICTION_BUY, meta });
  if (!charged) {
    await revertPrices(prediction, committed, q.index, q.shares, q.amount);
    return bad("Not enough KP");
  }

  const before = await PredictionPosition.findOneAndUpdate(
    { userId, predictionId: prediction._id, outcomeKey: q.outcomeKey },
    { $inc: { shares: q.shares, costBps: q.shares * q.avgBps, spent: q.amount } },
    { upsert: true }
  );
  // no pre-image means the upsert inserted, which is this player's first position here
  if (!before) await Prediction.updateOne({ _id: prediction._id }, { $inc: { traders: 1 } });

  const row = await recordTrade(prediction, userId, q, "buy", q.amount);
  return { ok: true, prediction: committed, spent: q.amount, user: charged, trade: row };
}

async function sell({ userId, prediction, q }) {
  const held = await PredictionPosition.findOne({ userId, predictionId: prediction._id, outcomeKey: q.outcomeKey });
  if (!held || held.shares < q.shares) return bad("You do not hold that many shares");

  const committed = await commitPrices(prediction, q.index, q.prices, -q.shares, q.amount);
  if (!committed) return null;

  // the guard that actually stops an oversell: two sells of the whole position race here,
  // and the filter on shares means only one of them finds enough left to take
  const basis = Math.round((held.costBps / held.shares) * q.shares);
  const reduced = await PredictionPosition.findOneAndUpdate(
    { _id: held._id, shares: { $gte: q.shares } },
    { $inc: { shares: -q.shares, costBps: -basis, spent: -q.amount } }
  );
  if (!reduced) {
    await revertPrices(prediction, committed, q.index, -q.shares, q.amount);
    return bad("You do not hold that many shares");
  }

  // a share sold at under half a KP rounds down to nothing, which is a real fill of zero
  const credited = q.amount > 0
    ? await creditUser(userId, q.amount, 0, { type: TX.PREDICTION_SELL, meta: tradeMeta(prediction, q) })
    : await User.findById(userId);

  const row = await recordTrade(prediction, userId, q, "sell", q.amount);
  return { ok: true, prediction: committed, received: q.amount, user: credited, trade: row };
}

const tradeMeta = (prediction, q) => ({
  predictionId: String(prediction._id),
  slug: prediction.slug,
  title: prediction.title,
  outcome: q.outcomeKey,
  shares: q.shares,
  avgPriceBps: q.avgBps,
});

// buy or sell, re-reading and re-quoting for as long as other people keep moving the book
async function trade({ userId, predictionId, outcomeKey, action, shares }) {
  if (action !== "buy" && action !== "sell") return bad("Unknown action");

  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt++) {
    const prediction = await Prediction.findById(predictionId);
    const closed = tradable(prediction);
    if (closed) return bad(closed);

    const q = quote(prediction, outcomeKey, action, shares);
    if (q.error) return q;

    const result = action === "buy"
      ? await buy({ userId, prediction, q })
      : await sell({ userId, prediction, q });
    if (result) return result;
    await backoff(attempt);
  }
  return bad("This market is busy right now, try again");
}

module.exports = { trade, quote, publicView, tradable, overCap, MAX_SHARES, ONE };
