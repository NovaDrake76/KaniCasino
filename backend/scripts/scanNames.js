require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const nameFilter = require("../utils/nameFilter");

// reports, never changes. the filter only guards new names, so anything registered before
// it shipped is still sitting there, and renaming somebody is a decision for a person.
//
// usage:  node scripts/scanNames.js
async function scan() {
  const hits = { usernames: [], descriptions: [] };

  const cursor = User.find({})
    .select("username email fixedItem.description")
    .lean()
    .cursor();

  let seen = 0;
  for await (const user of cursor) {
    seen += 1;
    const nameHit = nameFilter.findSlur(user.username);
    if (nameHit) {
      hits.usernames.push({ id: String(user._id), username: user.username, matched: nameHit });
    }
    const description = user.fixedItem && user.fixedItem.description;
    const descHit = description ? nameFilter.findSlur(description) : null;
    if (descHit) {
      hits.descriptions.push({
        id: String(user._id),
        username: user.username,
        description,
        matched: descHit,
      });
    }
  }

  return { seen, ...hits };
}

if (require.main === module) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(scan)
    .then((r) => {
      console.log(`scanned ${r.seen} accounts`);
      console.log(`usernames: ${r.usernames.length}`);
      for (const h of r.usernames) console.log(`  ${h.id}  ${h.username}  [${h.matched}]`);
      console.log(`descriptions: ${r.descriptions.length}`);
      for (const h of r.descriptions) console.log(`  ${h.id}  ${h.username}: ${h.description}  [${h.matched}]`);
      return mongoose.disconnect();
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { scan };
