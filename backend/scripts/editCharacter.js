require("dotenv").config();
const mongoose = require("mongoose");
const Item = require("../models/Item");
const User = require("../models/User");
const Marketplace = require("../models/Marketplace");
const BuyOrder = require("../models/BuyOrder");

// renames a character or gives it new art, in the catalog and in every copy of the name or picture stored beside it
// usage: node scripts/editCharacter.js "<name>" [--name "<new name>"] [--image <url>] [--apply]
async function editCharacter(from, { name, image, dry = true } = {}) {
  const items = await Item.find({ $or: [{ name: from }, { character: from }] }, { name: 1, character: 1, image: 1, slug: 1 }).lean();
  const own = items.filter((item) => item.name === from);
  if (!own.length) return { error: `no item is called ${from}` };

  const renaming = !!name && name !== from;
  // a character that already exists under the new name would fold two fan boards into one
  if (renaming && (await Item.exists({ _id: { $nin: items.map((item) => item._id) }, $or: [{ name }, { character: name }] }))) {
    return { error: `${name} is already a character` };
  }

  const ids = own.map((item) => item._id);
  const oldImages = own.map((item) => item.image).filter(Boolean);
  const plan = {
    items: own.map((item) => ({ _id: String(item._id), slug: item.slug || null, image: item.image })),
    alts: items.filter((item) => item.name !== from).map((item) => item.name),
    pins: await User.countDocuments({ "fixedItem.name": from }),
    listings: await Marketplace.countDocuments({ item: { $in: ids } }),
    orders: await BuyOrder.countDocuments({ item: { $in: ids }, status: "open" }),
  };
  if (dry) return { plan };

  const itemSet = {};
  const snapshot = {};
  if (renaming) {
    itemSet.name = name;
    snapshot.itemName = name;
  }
  if (image) {
    itemSet.image = image;
    snapshot.itemImage = image;
  }
  if (!Object.keys(itemSet).length) return { plan, done: null };

  // the slug is left alone, so every link to the item keeps working
  await Item.updateMany({ _id: { $in: ids } }, { $set: itemSet });
  if (renaming) {
    await Item.updateMany({ character: from }, { $set: { character: name } });
    await User.updateMany({ "fixedItem.name": from }, { $set: { "fixedItem.name": name } });
  }
  // only a pin on the base art takes the new picture; an alt outfit keeps its own
  if (image) {
    await User.updateMany({ "fixedItem.name": renaming ? name : from, "fixedItem.image": { $in: oldImages } }, { $set: { "fixedItem.image": image } });
  }
  await Marketplace.updateMany({ item: { $in: ids } }, { $set: snapshot });
  await BuyOrder.updateMany({ item: { $in: ids }, status: "open" }, { $set: snapshot });
  return { plan, done: { items: ids.length, pins: plan.pins, listings: plan.listings, orders: plan.orders } };
}

const flag = (key) => {
  const at = process.argv.indexOf(key);
  return at > 0 ? process.argv[at + 1] : undefined;
};

async function main() {
  const from = process.argv[2];
  if (!from || from.startsWith("--")) {
    console.error('usage: node scripts/editCharacter.js "<name>" [--name "<new name>"] [--image <url>] [--apply]');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const result = await editCharacter(from, { name: flag("--name"), image: flag("--image"), dry: !process.argv.includes("--apply") });
  console.log(JSON.stringify(result, null, 2));
  if (result.plan && !result.done) console.log("dry run. pass --apply to write it.");
  // the api's catalog turns over within five minutes and the fan boards on their next ten minute sweep
  if (result.done) console.log("written. the site shows it within five minutes, the fan board within ten.");
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("editCharacter:", err.message);
    process.exit(1);
  });
}

module.exports = { editCharacter };
