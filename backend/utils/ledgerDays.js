const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const LedgerDay = require("../models/LedgerDay");
const LedgerFold = require("../models/LedgerFold");
const Leaderboard = require("../models/Leaderboard");
const MissionState = require("../models/MissionState");
const memo = require("./memo");
const { TX } = require("./economy");
const predictionStake = require("./predictionStake");

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const FOLD_ID = "fold";
// a day folds this long after it ends, so a money write that began before midnight has committed
const GRACE_MS = 15 * 60 * 1000;
// how long one run may fold or delete before it leaves the rest to the next tick
const RUN_BUDGET_MS = 30 * 1000;
const WATERMARK_TTL_MS = 10 * 60 * 1000;

// plinko, dice and slots write two rows a round and nothing reads one back once the round is over. the
// stateful games, bonuses and sales keep theirs past every recovery sweep and round lookup, which go back minutes.
const SHORT_TYPES = [TX.PLINKO_BET, TX.PLINKO_WIN, TX.DICE_BET, TX.DICE_WIN, TX.SLOT_BET, TX.SLOT_WIN];
const LONG_TYPES = [
  TX.CASE_OPEN, TX.MINES_BET, TX.MINES_WIN, TX.BLACKJACK_BET, TX.BLACKJACK_WIN, TX.BLACKJACK_PUSH,
  TX.CRASH_BET, TX.CRASH_CASHOUT, TX.COINFLIP_BET, TX.COINFLIP_WIN, TX.HILO_BET, TX.HILO_WIN,
  TX.BONUS, TX.GAME_CREDIT, TX.GAME_CREDIT_EXPIRED, TX.ITEM_SELL,
];
const SHORT_DAYS = 3;
const LONG_DAYS = 14;
// a payout this size stays a row for good, so the backoffice's biggest wins never lose one
const KEEP_CREDIT_AT = 50000;

const pruneEnabled = () => process.env.LEDGER_PRUNE === "1";
const retention = () => (pruneEnabled() ? { shortDays: SHORT_DAYS, longDays: LONG_DAYS } : null);

const oid = (ms) => mongoose.Types.ObjectId.createFromTime(Math.floor(ms / 1000));
const dayStart = (at) => Math.floor(new Date(at).getTime() / DAY) * DAY;

const SIDE_BET = { $or: [{ $eq: ["$meta.double", true] }, { $eq: ["$meta.split", true] }, { $eq: ["$meta.insurance", true] }] };

// a raw row in the folded shape, so one $group reads a stream of both
const ROW = {
  _id: 0,
  userId: 1,
  type: 1,
  direction: 1,
  counterparty: { $ifNull: ["$counterparty", null] },
  tag: {
    $ifNull: [
      {
        $switch: {
          branches: [
            { case: { $eq: ["$type", TX.CASE_OPEN] }, then: "$meta.caseId" },
            { case: { $eq: ["$type", TX.ITEM_SELL] }, then: "$meta.source" },
          ],
          default: null,
        },
      },
      null,
    ],
  },
  day: "$createdAt",
  count: { $literal: 1 },
  amount: 1,
  max: "$amount",
  qty: { $ifNull: ["$meta.quantity", 0] },
  units: { $max: [{ $ifNull: ["$meta.quantity", 1] }, 1] },
  base: { $cond: [SIDE_BET, 0, 1] },
  full: { $cond: [{ $gte: ["$meta.fill", 1] }, 1, 0] },
  credit: { $cond: [{ $gt: ["$meta.credit", 0] }, 1, 0] },
  last: "$createdAt",
  title: "$meta.caseTitle",
};

const SUMS = {
  count: { $sum: "$count" },
  amount: { $sum: "$amount" },
  max: { $max: "$max" },
  qty: { $sum: "$qty" },
  units: { $sum: "$units" },
  base: { $sum: "$base" },
  full: { $sum: "$full" },
  credit: { $sum: "$credit" },
  last: { $max: "$last" },
};

const readThrough = async () => {
  const doc = await LedgerFold.findById(FOLD_ID, { through: 1 }).lean();
  return doc && doc.through ? doc.through : null;
};

// rows with an _id before this are read from the daily totals, rows from it on from the ledger itself
const watermark = () => memo.remember("ledger:through", WATERMARK_TTL_MS, readThrough);

// the opening stages of an aggregation over the whole ledger: raw rows from the watermark on, folded days before it.
// `match` may only name fields both carry (userId, type, direction, counterparty); a `since` on a folded day counts all of it.
async function stream(match = {}, { since = null } = {}) {
  const through = await watermark();
  const from = since ? new Date(since).getTime() : null;
  const edge = through ? through.getTime() : null;
  if (edge === null || (from !== null && from >= edge)) {
    const raw = from === null ? match : { ...match, createdAt: { $gte: new Date(from) } };
    return [{ $match: raw }, { $project: ROW }];
  }
  const day = { $lt: through };
  if (from !== null) day.$gte = new Date(dayStart(from));
  return [
    // an app row is stamped after its _id is minted, so the createdAt bound drops nothing and lets the indexes narrow the scan
    { $match: { ...match, _id: { $gte: oid(edge) }, createdAt: { $gte: through } } },
    { $project: ROW },
    { $unionWith: { coll: LedgerDay.collection.collectionName, pipeline: [{ $match: { ...match, day } }] } },
  ];
}

// one utc day of rows into its totals, inside mongo: nothing comes back to the box
async function foldDay(start) {
  await Transaction.aggregate([
    { $match: { _id: { $gte: oid(start), $lt: oid(start + DAY) } } },
    { $sort: { _id: 1 } },
    { $project: ROW },
    {
      $group: {
        _id: {
          day: { $literal: new Date(start) },
          userId: "$userId",
          type: "$type",
          direction: "$direction",
          counterparty: "$counterparty",
          tag: "$tag",
        },
        ...SUMS,
        title: { $last: "$title" },
      },
    },
    {
      $set: {
        day: "$_id.day",
        userId: "$_id.userId",
        type: "$_id.type",
        direction: "$_id.direction",
        counterparty: "$_id.counterparty",
        tag: "$_id.tag",
      },
    },
    { $merge: { into: LedgerDay.collection.collectionName, on: "_id", whenMatched: "replace", whenNotMatched: "insert" } },
  ]);
}

// a roadmap chapter counts from the moment it opened, which a day's totals cannot tell once the rows are gone,
// so what the opening day held after that moment is kept on the chapter itself
async function freezeOpenings(start) {
  const end = start + DAY;
  const states = await MissionState.find(
    { "roadmap.openedAt": { $gte: new Date(start), $lt: new Date(end) } },
    { userId: 1, "roadmap.openedAt": 1 }
  ).lean();
  for (const state of states) {
    const since = state.roadmap.openedAt;
    const types = await Transaction.aggregate([
      { $match: { userId: state.userId, createdAt: { $gte: since, $lt: new Date(end + HOUR) }, _id: { $lt: oid(end) } } },
      { $project: ROW },
      { $group: { _id: "$type", ...SUMS, later: predictionStake.laterBuyAmount() } },
    ]);
    if (!types.length) continue;
    await MissionState.updateOne(
      { _id: state._id, "roadmap.openedAt": since },
      { $set: { "roadmap.head": { since, types: types.map(({ _id, ...sums }) => ({ type: _id, ...sums })) } } }
    );
  }
}

async function firstDay() {
  const first = await Transaction.findOne({}, { _id: 1 }).sort({ _id: 1 }).lean();
  return first ? dayStart(first._id.getTimestamp()) : null;
}

// fold every day that has closed and the watermark has not reached, oldest first. the watermark only moves
// forward and only after the day's totals are written, so a reader never sees a day counted twice or not at all.
async function foldClosedDays({ now = Date.now(), budgetMs = RUN_BUDGET_MS } = {}) {
  const started = Date.now();
  await LedgerFold.updateOne({ _id: FOLD_ID }, { $setOnInsert: { through: null } }, { upsert: true });
  const doc = await LedgerFold.findById(FOLD_ID).lean();
  let next = doc.through ? doc.through.getTime() : await firstDay();
  // a day the prune has reached would fold short and overwrite the totals that are now its only record
  const pruned = Math.max(doc.shortTo ? doc.shortTo.getTime() : 0, doc.longTo ? doc.longTo.getTime() : 0);
  if (next !== null && next < pruned) throw new Error(`ledger fold: through ${new Date(next).toISOString()} is behind the prune, refusing to refold`);
  let folded = 0;
  while (next !== null && next + DAY + GRACE_MS <= now && Date.now() - started < budgetMs) {
    await foldDay(next);
    await freezeOpenings(next);
    await LedgerFold.updateOne(
      { _id: FOLD_ID, $or: [{ through: null }, { through: { $lt: new Date(next + DAY) } }] },
      { $set: { through: new Date(next + DAY) } }
    );
    next += DAY;
    folded += 1;
  }
  if (folded) memo.forget("ledger:");
  return folded;
}

// delete what each retention has let go of, one hour of rows per command, from where the last run stopped.
// never past the watermark, and never into a day a leaderboard still has to pay from.
async function prune({ now = Date.now(), budgetMs = RUN_BUDGET_MS } = {}) {
  if (!pruneEnabled()) return 0;
  const doc = await LedgerFold.findById(FOLD_ID).lean();
  if (!doc || !doc.through) return 0;
  const owed = await Leaderboard.findOne({ settlementDone: { $ne: true } }, { startsAt: 1 }).sort({ startsAt: 1 }).lean();
  const ceiling = Math.min(doc.through.getTime(), owed ? owed.startsAt.getTime() : Infinity);
  const started = Date.now();
  let deleted = 0;
  for (const [cursor, types, days] of [["shortTo", SHORT_TYPES, SHORT_DAYS], ["longTo", LONG_TYPES, LONG_DAYS]]) {
    const until = Math.min(ceiling, Math.floor((now - days * DAY) / HOUR) * HOUR);
    let from = doc[cursor] ? doc[cursor].getTime() : await firstDay();
    while (from !== null && from < until && Date.now() - started < budgetMs) {
      const to = Math.min(from + HOUR, until);
      const res = await Transaction.deleteMany({
        _id: { $gte: oid(from), $lt: oid(to) },
        type: { $in: types },
        $nor: [{ direction: "credit", amount: { $gte: KEEP_CREDIT_AT } }],
      });
      deleted += res.deletedCount || 0;
      from = to;
      await LedgerFold.updateOne({ _id: FOLD_ID }, { $set: { [cursor]: new Date(from) } });
    }
  }
  return deleted;
}

let running = false;

// the cron's one entry: fold, then prune, never two runs at once in this process
async function run(options = {}) {
  if (running) return { folded: 0, deleted: 0 };
  running = true;
  try {
    const folded = await foldClosedDays(options);
    const deleted = await prune(options);
    return { folded, deleted };
  } finally {
    running = false;
  }
}

module.exports = {
  DAY,
  ROW,
  SUMS,
  SHORT_TYPES,
  LONG_TYPES,
  SHORT_DAYS,
  LONG_DAYS,
  KEEP_CREDIT_AT,
  oid,
  dayStart,
  watermark,
  stream,
  foldClosedDays,
  prune,
  run,
  retention,
  pruneEnabled,
};
