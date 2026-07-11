// one-time migration: materialize the provably-fair range table + config version for
// every case (and archive it in CaseConfig). safe to re-run: recomputeCaseValues only
// bumps a case's config version when its mapping actually changes.
//
// usage (from backend/):
//   node scripts/backfillCaseConfig.js
require("dotenv").config();
const mongoose = require("mongoose");
const Case = require("../models/Case");
const CaseConfig = require("../models/CaseConfig");
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

  const withConfig = await Case.countDocuments({ configHash: { $ne: null } });
  const configs = await CaseConfig.countDocuments({});
  console.log(
    `recomputed ${cases.length} cases; ${withConfig} now have a committed config; ${configs} config versions archived`
  );

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
