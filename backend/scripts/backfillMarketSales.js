// Rebuild price history from the transaction ledger.
//
// Listings are hard-deleted on purchase, so before the MarketSale collection existed
// the only trace of a completed sale was the market_sale ledger row. Those rows carry
// the price (as `amount`) and the item NAME, but no itemId, so we match by name.
// Historical sales predate the market fee, so fee = 0 and sellerNet = price.
//
// Usage:
//   node scripts/backfillMarketSales.js          (dry run: reports what it would do)
//   node scripts/backfillMarketSales.js --apply  (writes)
//
// Idempotent: skips any sale already recorded for the same listingId + soldAt.
require("dotenv").config();
const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const Item = require("../models/Item");
const MarketSale = require("../models/MarketSale");
const { TX } = require("../utils/economy");

const APPLY = process.argv.includes("--apply");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const rows = await Transaction.find({ type: TX.MARKET_SALE }).sort({ createdAt: 1 }).lean();
  console.log(`found ${rows.length} market_sale ledger rows`);

  // name -> item. ambiguous names (same name on two items) are skipped: we cannot
  // know which one traded, and guessing would poison the price history.
  const items = await Item.find({}, { name: 1, rarity: 1 }).lean();
  const byName = new Map();
  for (const it of items) {
    const key = String(it.name);
    if (byName.has(key)) byName.set(key, null); // duplicate name -> unusable
    else byName.set(key, it);
  }

  let created = 0;
  let skippedExisting = 0;
  let unmatched = 0;
  let ambiguous = 0;

  for (const tx of rows) {
    const meta = tx.meta || {};
    const name = meta.itemName;
    // newer rows already carry itemId; prefer it when present
    let item = meta.itemId ? items.find((i) => String(i._id) === String(meta.itemId)) : null;
    if (!item && name) {
      const hit = byName.get(String(name));
      if (hit === null) {
        ambiguous += 1;
        continue;
      }
      item = hit;
    }
    if (!item) {
      unmatched += 1;
      continue;
    }

    const exists = await MarketSale.findOne({
      listingId: meta.listingId || null,
      soldAt: tx.createdAt,
      item: item._id,
    });
    if (exists) {
      skippedExisting += 1;
      continue;
    }

    // the seller was credited the full price back then (no fee existed)
    const price = meta.price || tx.amount;
    if (APPLY) {
      await MarketSale.create({
        item: item._id,
        itemName: item.name,
        rarity: item.rarity,
        price,
        fee: meta.fee || 0,
        sellerNet: tx.amount,
        sellerId: tx.userId,
        buyerId: meta.buyerId || null,
        listingId: meta.listingId || null,
        soldAt: tx.createdAt,
      });
    }
    created += 1;
  }

  console.log(
    `${APPLY ? "created" : "would create"} ${created} | already recorded ${skippedExisting} | unmatched name ${unmatched} | ambiguous name ${ambiguous}`
  );
  if (!APPLY) console.log("dry run, pass --apply to write");
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
