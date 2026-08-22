// opens prediction markets from a slate file, so the wording, the clock and the liquidity
// settings are reviewed in a diff rather than typed into a form five times.
//
//   node scripts/openPredictions.js slates/<name>.json          # dry run, prints what it would do
//   node scripts/openPredictions.js slates/<name>.json --commit  # writes
//
// idempotent on the slug: a market that already exists is left exactly as it is, so a
// half-finished run is fixed by running it again.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Prediction = require("../models/Prediction");
const { DEFAULT_VIG_BPS, DEFAULT_IMPACT_BPS, openingPrices } = require("../utils/predictionMath");

const slugify = (title) =>
  String(title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function validate(spec, index) {
  const where = `market ${index + 1} (${spec.title || "untitled"})`;
  if (!spec.title) throw new Error(`${where}: needs a title`);
  if (!spec.description) throw new Error(`${where}: needs a description saying what settles it`);
  if (!Array.isArray(spec.outcomes) || spec.outcomes.length < 2) {
    throw new Error(`${where}: needs at least two outcomes`);
  }
  if (spec.outcomes.length > 8) throw new Error(`${where}: at most eight outcomes`);
  if (!spec.endsAt || isNaN(new Date(spec.endsAt).getTime())) throw new Error(`${where}: needs a valid endsAt`);
  if (new Date(spec.endsAt).getTime() <= Date.now()) throw new Error(`${where}: endsAt is in the past`);
}

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) throw new Error("usage: node scripts/openPredictions.js <slate.json> [--commit]");
  const commit = flags.includes("--commit");

  const slate = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  slate.forEach(validate);

  await mongoose.connect(process.env.MONGO_URI);

  let opened = 0;
  let skipped = 0;
  for (const spec of slate) {
    const slug = spec.slug || slugify(spec.title);
    const existing = await Prediction.findOne({ slug }).select("slug status volume").lean();
    if (existing) {
      console.log(`  skip   ${slug}  (already open, ${existing.status}, ${existing.volume} K volume)`);
      skipped += 1;
      continue;
    }

    const vigBps = spec.vigBps || DEFAULT_VIG_BPS;
    const impactBps = spec.impactBps || DEFAULT_IMPACT_BPS;
    const prices = openingPrices(spec.outcomes.length, vigBps);
    const doc = {
      slug,
      title: spec.title,
      description: spec.description,
      image: spec.image,
      category: spec.category || "General",
      endsAt: new Date(spec.endsAt),
      vigBps,
      impactBps,
      exposureCap: spec.exposureCap || 10000,
      outcomes: spec.outcomes.map((label, i) => ({
        key: `o${i + 1}`,
        label,
        priceBps: prices[i],
        shares: 0,
        volume: 0,
      })),
    };

    if (!commit) {
      console.log(`  would open  ${slug}`);
      console.log(`      ${spec.title}`);
      console.log(`      ${spec.outcomes.join(" / ")}  @ ${prices.map((p) => (p / 100).toFixed(0) + "%").join(" / ")}`);
      console.log(`      ends ${doc.endsAt.toISOString()}  impact ${impactBps}bps  cap ${doc.exposureCap} K`);
      console.log(`      image ${spec.image || "(none)"}`);
      opened += 1;
      continue;
    }

    await Prediction.create(doc);
    console.log(`  opened ${slug}`);
    opened += 1;
  }

  console.log(`\n${commit ? "opened" : "would open"} ${opened}, skipped ${skipped}`);
  if (!commit) console.log("nothing was written. re-run with --commit");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
