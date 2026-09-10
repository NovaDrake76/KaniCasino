// put an account into a beta from the shell, or list who is in one.
//
//   node scripts/beta.js daisu list
//   node scripts/beta.js daisu <username|slug|id> on
//   node scripts/beta.js daisu <username|slug|id> off
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const beta = require("../utils/beta");

const [flag, who, state] = process.argv.slice(2);

(async () => {
  if (!beta.FLAGS.includes(flag)) {
    console.error(`known betas: ${beta.FLAGS.join(", ")}`);
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  if (who === "list" || !who) {
    const users = await User.find({ betaFlags: flag }).select("username slug").lean();
    for (const u of users) console.log(`${u.username} (${u.slug})`);
    console.log(`${users.length} in ${flag}`);
  } else {
    const filter = mongoose.isValidObjectId(who) ? { _id: who } : { $or: [{ username: who }, { slug: who }] };
    const op = state === "off" ? { $pull: { betaFlags: flag } } : { $addToSet: { betaFlags: flag } };
    const u = await User.findOneAndUpdate(filter, op, { new: true, projection: { username: 1, betaFlags: 1 } });
    if (!u) console.error("no such user");
    else console.log(`${u.username}: ${(u.betaFlags || []).join(", ") || "(none)"}`);
  }
  await mongoose.disconnect();
})();
