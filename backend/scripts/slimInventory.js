// one-time migration: drop name/image/case from every inventory entry. they duplicate
// the catalog on all ~293k rows and are joined back on read. safe to re-run: the unset
// is a no-op once a field is gone.
//
// usage (from backend/):
//   node scripts/slimInventory.js           # dry run, reports what would change
//   node scripts/slimInventory.js --apply   # actually writes the changes
require("dotenv").config();
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (run from backend/ with its .env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(APPLY ? "APPLY mode: writing changes" : "DRY RUN: no changes will be written");

  const users = mongoose.connection.db.collection("users");
  const filter = {
    $or: [
      { "inventory.name": { $exists: true } },
      { "inventory.image": { $exists: true } },
      { "inventory.case": { $exists: true } },
    ],
  };

  const affected = await users.countDocuments(filter);
  const entries = await users
    .aggregate([
      { $project: { n: { $size: { $ifNull: ["$inventory", []] } } } },
      { $group: { _id: null, total: { $sum: "$n" } } },
    ])
    .toArray();
  const total = entries[0]?.total || 0;

  console.log(`users ${APPLY ? "to fix" : "with fat entries"}: ${affected}`);
  console.log(`inventory entries in total: ${total}`);
  console.log(`estimated saving: ~${((114 * total) / 1048576).toFixed(1)} MB`);

  if (APPLY) {
    const res = await users.updateMany(filter, {
      $unset: {
        "inventory.$[].name": "",
        "inventory.$[].image": "",
        "inventory.$[].case": "",
      },
    });
    console.log(`users written: ${res.modifiedCount}`);
    const left = await users.countDocuments(filter);
    console.log(`users still carrying the fields: ${left}`);
  }

  console.log(APPLY ? "done." : "dry run complete, re-run with --apply to write.");
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
