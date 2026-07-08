// one-time migration: compute and store baseValue for every item, per case.
// safe to re-run (it just recomputes). additive (only sets baseValue).
//
// usage (from backend/):
//   node scripts/backfillItemValue.js
require("dotenv").config();
const mongoose = require("mongoose");
const Case = require("../models/Case");
const Item = require("../models/Item");
const { recomputeCaseValues } = require("../utils/itemValue");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (run from backend/ with its .env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const cases = await Case.find({}, { _id: 1 }).lean();
  for (const c of cases) {
    await recomputeCaseValues(c._id);
  }

  const withValue = await Item.countDocuments({ baseValue: { $gt: 0 } });
  const total = await Item.countDocuments({});
  console.log(`recomputed ${cases.length} cases; ${withValue}/${total} items now have a base value`);

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
