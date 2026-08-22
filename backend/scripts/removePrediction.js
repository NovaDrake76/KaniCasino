// deletes a market that nobody has touched.
//
//   node scripts/removePrediction.js <slug> [<slug> ...]            # dry run
//   node scripts/removePrediction.js <slug> [<slug> ...] --commit   # deletes
//
// a market with any volume or any position is refused: taking somebody's KP and then making
// the market disappear is not a thing this should be able to do. Void it from the Backoffice
// instead, which refunds every position at what it cost.

require("dotenv").config();
const mongoose = require("mongoose");
const Prediction = require("../models/Prediction");
const PredictionPosition = require("../models/PredictionPosition");
const PredictionTrade = require("../models/PredictionTrade");
const PredictionPricepoint = require("../models/PredictionPricepoint");

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const slugs = args.filter((a) => !a.startsWith("--"));
  if (slugs.length === 0) throw new Error("usage: node scripts/removePrediction.js <slug> [...] [--commit]");

  await mongoose.connect(process.env.MONGO_URI);

  let removed = 0;
  for (const slug of slugs) {
    const market = await Prediction.findOne({ slug });
    if (!market) {
      console.log(`  missing  ${slug}`);
      continue;
    }

    const positions = await PredictionPosition.countDocuments({ predictionId: market._id });
    const trades = await PredictionTrade.countDocuments({ predictionId: market._id });
    if (market.volume > 0 || positions > 0 || trades > 0) {
      console.log(`  REFUSED  ${slug}  (${market.volume} K volume, ${positions} positions, ${trades} trades) — void it instead`);
      continue;
    }

    if (!commit) {
      console.log(`  would remove  ${slug}  "${market.title}"`);
      removed += 1;
      continue;
    }

    // the price points written when the market opened have nothing left to belong to
    await PredictionPricepoint.deleteMany({ predictionId: market._id });
    await Prediction.deleteOne({ _id: market._id });
    console.log(`  removed  ${slug}`);
    removed += 1;
  }

  console.log(`\n${commit ? "removed" : "would remove"} ${removed} of ${slugs.length}`);
  if (!commit) console.log("nothing was written. re-run with --commit");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
