// one-time migration: give existing inventory items and marketplace listings the
// `case` they were missing (items bought before case was preserved). additive and
// idempotent — it only fills a missing case, never changes an existing one.
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

(async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set (run from backend/ with its .env)");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(APPLY ? "APPLY mode — writing changes" : "DRY RUN — no changes will be written");

  // map of itemId -> case
  const items = await Item.find({}, { _id: 1, case: 1 }).lean();
  const caseById = new Map(items.map((i) => [i._id.toString(), i.case]));

  // marketplace listings missing a case
  let listingsFixed = 0;
  let listingsUnresolved = 0;
  const listings = await Marketplace.find({ $or: [{ case: { $exists: false } }, { case: null }] });
  for (const listing of listings) {
    const c = caseById.get(listing.item?.toString());
    if (c) {
      listingsFixed += 1;
      if (APPLY) {
        listing.case = c;
        await listing.save();
      }
    } else {
      listingsUnresolved += 1; // source item no longer exists
    }
  }

  // user inventory items missing a case
  let usersChanged = 0;
  let invFixed = 0;
  let invUnresolved = 0;
  const users = await User.find({});
  for (const user of users) {
    let changed = false;
    for (const inv of user.inventory) {
      if (!inv.case) {
        const c = caseById.get(inv._id?.toString());
        if (c) {
          invFixed += 1;
          changed = true;
          if (APPLY) inv.case = c;
        } else {
          invUnresolved += 1;
        }
      }
    }
    if (changed) {
      usersChanged += 1;
      if (APPLY) await user.save();
    }
  }

  console.log(`marketplace listings: ${listingsFixed} fixed, ${listingsUnresolved} unresolved (item deleted)`);
  console.log(`inventory items: ${invFixed} fixed across ${usersChanged} users, ${invUnresolved} unresolved`);
  console.log(APPLY ? "done." : "dry run complete — re-run with --apply to write.");

  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
