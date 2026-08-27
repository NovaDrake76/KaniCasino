require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { slugify, baseSlugFor, RESERVED } = require("../utils/slugs");

// gives every account its profile url. the oldest account holding a name keeps the bare
// slug and later ones get -2, -3, so whoever has been linked to longest keeps their link.
// a username with no latin letters in it gets no slug at all and keeps its id url; that is
// deliberate, since the alternative is inventing a name for somebody. a name the filter
// rejects keeps its id url too, so no slur ends up in a shareable link.
//
// usage:
//   node scripts/backfillUserSlug.js --dry
//   node scripts/backfillUserSlug.js
async function backfill({ dry = false } = {}) {
  // only the two fields, never the inventories: this collection is tens of megabytes
  const users = await User.find({}, { username: 1, slug: 1 }).sort({ _id: 1 }).lean();

  const taken = new Set(users.filter((u) => u.slug).map((u) => u.slug));
  const plan = [];
  let skipped = 0;
  let unslugabble = 0;

  for (const user of users) {
    if (user.slug) {
      skipped++;
      continue;
    }
    const base = baseSlugFor(user.username);
    if (!base) {
      unslugabble++;
      continue;
    }
    let slug = base;
    for (let n = 2; taken.has(slug) || RESERVED.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    plan.push({ _id: user._id, username: user.username, slug });
  }

  console.log(`${users.length} accounts | ${skipped} already had a slug | ${unslugabble} cannot have one`);
  console.log(`${plan.length} to write`);
  const suffixed = plan.filter((p) => /-\d+$/.test(p.slug) && slugify(p.username) !== p.slug);
  console.log(`${suffixed.length} had to take a suffix:`);
  suffixed.slice(0, 40).forEach((p) => console.log(`   ${p.username} -> ${p.slug}`));

  if (dry) return plan;

  for (let i = 0; i < plan.length; i += 500) {
    const chunk = plan.slice(i, i + 500);
    await User.bulkWrite(
      chunk.map((p) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { slug: p.slug } } } }))
    );
    console.log(`wrote ${Math.min(i + 500, plan.length)}/${plan.length}`);
  }
  return plan;
}

if (require.main === module) {
  const dry = process.argv.includes("--dry");
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => backfill({ dry }))
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = backfill;
