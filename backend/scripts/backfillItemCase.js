// one-time migration: give existing inventory items and marketplace listings the
// `case` they were missing (items bought before case was preserved). additive and
// idempotent: only fills a missing case, never changes an existing one.
//
// safe to run on a live DB: it uses atomic positional updates that touch only the
// `case` subfield, so it can't clobber inventory changes made by concurrent play.
//
// usage (from backend/):
//   node scripts/backfillItemCase.js          # dry run, reports what would change
//   node scripts/backfillItemCase.js --apply   # actually writes the changes
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Item = require("../models/Item");
const Marketplace = require("../models/Marketplace");

const APPLY = process.argv.includes("--apply");
const MISSING = { $in: [null] }; // matches both a missing field and an explicit null

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (run from backend/ with its .env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(APPLY ? "APPLY mode: writing changes" : "DRY RUN: no changes will be written");

  const items = await Item.find({}, { _id: 1, case: 1 }).lean();
  const withCase = items.filter((i) => i.case);

  // marketplace listings missing a case: one atomic updateMany per item
  let listingsFixed = 0;
  for (const it of withCase) {
    const filter = { item: it._id, case: MISSING };
    if (APPLY) {
      listingsFixed += (await Marketplace.updateMany(filter, { $set: { case: it.case } })).modifiedCount;
    } else {
      listingsFixed += await Marketplace.countDocuments(filter);
    }
  }

  // user inventory items missing a case; atomic positional update per item.
  // a null/malformed inventory slot has no _id, so it simply isn't matched.
  let invFixed = 0;
  for (const it of withCase) {
    if (APPLY) {
      const r = await User.updateMany(
        { inventory: { $elemMatch: { _id: it._id, case: MISSING } } },
        { $set: { "inventory.$[e].case": it.case } },
        { arrayFilters: [{ "e._id": it._id, "e.case": MISSING }] }
      );
      invFixed += r.modifiedCount; // users updated for this item
    } else {
      const agg = await User.aggregate([
        { $unwind: "$inventory" },
        { $match: { "inventory._id": it._id, "inventory.case": MISSING } },
        { $count: "n" },
      ]);
      invFixed += agg.length ? agg[0].n : 0; // inventory items for this item
    }
  }

  console.log(`marketplace listings ${APPLY ? "fixed" : "to fix"}: ${listingsFixed}`);
  console.log(`inventory ${APPLY ? "users updated" : "items to fix"}: ${invFixed}`);
  console.log(APPLY ? "done." : "dry run complete, re-run with --apply to write.");

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
