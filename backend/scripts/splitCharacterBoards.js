// Gives one side of a shared character name a name of its own, so the two stop sharing
// a fan board.
//
//   node scripts/splitCharacterBoards.js "Blue Archive"           # what it would do
//   node scripts/splitCharacterBoards.js "Blue Archive" --apply
//
// The named collection is the one that moves: its items get `character` set to
// "<name> (<collection>)", which is what the board is keyed by. Item names are untouched,
// so nothing changes in a case, an inventory or the market.
//
// Whoever already pinned the side that keeps the plain name keeps their board, their
// standing and their tie-break. Check that first with checkCharacterCollisions.js: the
// collection to move is the one nobody has pinned.
require("dotenv").config();
const mongoose = require("mongoose");

const Item = require("../models/Item");
const Case = require("../models/Case");
const User = require("../models/User");
const fandom = require("../utils/fandom");
const itemCatalog = require("../utils/itemCatalog");
const { collisions } = require("./checkCharacterCollisions");

async function plan(moving) {
  const found = await collisions();
  const cases = await Case.find({}, { category: 1, items: 1 }).lean();
  const categoryOf = new Map();
  for (const one of cases) {
    for (const id of one.items || []) categoryOf.set(String(id), one.category);
  }

  const moves = [];
  for (const [key, spread] of found) {
    const mine = spread.get(moving);
    if (!mine) continue;
    if (spread.size < 2) continue;
    const renamed = `${key} (${moving})`;
    for (const item of mine) {
      if (item.character === renamed) continue;
      moves.push({ _id: item._id, name: item.name, from: key, to: renamed });
    }
  }
  return { moves, categoryOf };
}

async function main() {
  const moving = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!moving) {
    console.error('usage: node scripts/splitCharacterBoards.js "<collection>" [--apply]');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const { moves } = await plan(moving);

  if (!moves.length) {
    console.log(`nothing in ${moving} shares a character with another collection`);
    await mongoose.disconnect();
    return;
  }

  // a pin on the moving side would be left pointing at the other collection's board, so
  // it has to be seen rather than discovered afterwards
  const stranded = await User.find(
    { "fixedItem.name": { $in: [...new Set(moves.map((move) => move.from))] }, disabled: { $ne: true } },
    { username: 1, "fixedItem.name": 1, "fixedItem.image": 1 }
  ).lean();
  const movingImages = new Set(
    (await Item.find({ _id: { $in: moves.map((move) => move._id) } }, { image: 1 }).lean()).map((item) => item.image)
  );
  const atRisk = stranded.filter((user) => user.fixedItem && movingImages.has(user.fixedItem.image));

  console.log(`${moves.length} item${moves.length === 1 ? "" : "s"} in ${moving} would be renamed:\n`);
  for (const move of moves) console.log(`   ${move.name.padEnd(26)} ${move.from}  ->  ${move.to}`);
  console.log(`\npins on the moving side that would need repointing: ${atRisk.length}`);
  for (const user of atRisk) console.log(`   ${user.username} (${user.fixedItem.name})`);

  if (!apply) {
    console.log("\ndry run. pass --apply to write it.");
    await mongoose.disconnect();
    return;
  }
  if (atRisk.length) {
    console.error("\nrefusing: repoint those pins first, or move the other collection instead.");
    await mongoose.disconnect();
    process.exit(1);
  }

  await Item.bulkWrite(
    moves.map((move) => ({ updateOne: { filter: { _id: move._id }, update: { $set: { character: move.to } } } })),
    { ordered: false }
  );
  console.log(`\n${moves.length} items updated`);

  // a bulkWrite fires no hook, so the catalog would rebuild the boards off the old names
  itemCatalog.invalidate();

  const { boards, players } = await fandom.rebuild();
  console.log(`boards rebuilt: ${boards} boards, ${players} players`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("split:", err.message);
    process.exit(1);
  });
}

module.exports = { plan };
