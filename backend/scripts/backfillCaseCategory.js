// one-time migration: set Case.category on the existing cases so the home page can
// group the listing into sections. exact-title map, only fills a missing/empty
// category and never overwrites, so re-running is a no-op. unknown titles are
// reported and skipped rather than guessed.
//
// usage (from backend/):
//   node scripts/backfillCaseCategory.js           # dry run, reports what would change
//   node scripts/backfillCaseCategory.js --apply   # actually writes the changes
require("dotenv").config();
const mongoose = require("mongoose");
const Case = require("../models/Case");

const APPLY = process.argv.includes("--apply");

const CATEGORY_BY_TITLE = {
  "Lunatic Case": "Touhou",
  "Nuclear Case": "Touhou",
  "The Special Package": "Touhou",
  "Recoil Case": "Counter-Strike",
  "Dogs Case": "Animals",
  "Cats Case": "Animals",
  "Kivotos Case": "Blue Archive",
  "Trinity Case": "Blue Archive",
  "Millennium Case": "Blue Archive",
  "Gehenna Case": "Blue Archive",
};

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (run from backend/ with its .env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(APPLY ? "APPLY mode: writing changes" : "DRY RUN: no changes will be written");

  const missing = await Case.find(
    { $or: [{ category: { $in: [null, ""] } }, { category: { $exists: false } }] },
    { title: 1, category: 1 }
  );

  let n = 0;
  for (const c of missing) {
    const category = CATEGORY_BY_TITLE[c.title];
    if (!category) {
      console.log(`skip "${c.title}" — no category mapped, add it to CATEGORY_BY_TITLE`);
      continue;
    }
    console.log(`"${c.title}" -> "${category}"`);
    if (APPLY) {
      await Case.updateOne({ _id: c._id }, { $set: { category } });
    }
    n += 1;
  }

  console.log(`${APPLY ? "fixed" : "to fix"}: ${n} (of ${missing.length} without a category)`);
  console.log(APPLY ? "done." : "dry run complete, re-run with --apply to write.");
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
