// Fails when one character key covers items from more than one collection.
//
//   node scripts/checkCharacterCollisions.js
//
// A fan board is keyed by character, and a character is `character || name`. Two series
// can use the same first name: Touhou and Blue Archive both have a Yukari, a Junko and a
// Yuuka. Left alone they share one board, so their copies are counted together, the board
// wears whichever portrait the catalog returned last, and a player's badge shows someone
// they have never held. It went unnoticed for months because nothing errors.
//
// Run it after every case import. Anything it prints needs a name of its own, which
// scripts/splitCharacterBoards.js gives it.
require("dotenv").config();
const mongoose = require("mongoose");

const Item = require("../models/Item");
const Case = require("../models/Case");
const FanBoard = require("../models/FanBoard");
const { characterOf } = require("../utils/fandom");

async function collisions() {
  const [items, cases] = await Promise.all([
    Item.find({}, { name: 1, character: 1, rarity: 1 }).lean(),
    Case.find({}, { category: 1, items: 1 }).lean(),
  ]);

  const categoryOf = new Map();
  for (const one of cases) {
    for (const id of one.items || []) categoryOf.set(String(id), one.category);
  }

  const byCharacter = new Map();
  for (const item of items) {
    const key = characterOf(item);
    const category = categoryOf.get(String(item._id)) || "(no case)";
    if (!byCharacter.has(key)) byCharacter.set(key, new Map());
    const spread = byCharacter.get(key);
    if (!spread.has(category)) spread.set(category, []);
    spread.get(category).push(item);
  }

  return [...byCharacter].filter(([, spread]) => spread.size > 1);
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const found = await collisions();

  if (!found.length) {
    console.log("every character belongs to one collection");
    await mongoose.disconnect();
    return;
  }

  const boards = await FanBoard.find({ name: { $in: found.map(([key]) => key) } }, { name: 1, fanCount: 1, topCount: 1 }).lean();
  const boardOf = new Map(boards.map((board) => [board.name, board]));

  console.log(`${found.length} character${found.length === 1 ? "" : "s"} shared across collections:\n`);
  for (const [key, spread] of found) {
    const board = boardOf.get(key);
    console.log(`${key}${board ? `  (${board.fanCount} fans, leader holds ${board.topCount})` : "  (no board)"}`);
    for (const [category, list] of spread) {
      console.log(`   ${category.padEnd(16)} ${list.map((item) => item.name).join(", ")}`);
    }
  }
  await mongoose.disconnect();
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error("collision check:", err.message);
    process.exit(1);
  });
}

module.exports = { collisions };
