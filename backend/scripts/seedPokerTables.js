require("dotenv").config();
const mongoose = require("mongoose");
const PokerTable = require("../models/PokerTable");
const { blankSeats } = require("../games/pokerTable");

// six always-open tables across three blind tiers. fixed rather than player-created: an
// empty lobby of player-made rooms reads as a dead game, and a small set concentrates
// however many players are actually online.
const TABLES = [
  { slug: "hakurei-1", name: "Hakurei Shrine", smallBlind: 5, bigBlind: 10 },
  { slug: "hakurei-2", name: "Hakurei Shrine II", smallBlind: 5, bigBlind: 10 },
  { slug: "kirisame-1", name: "Kirisame Magic Shop", smallBlind: 25, bigBlind: 50 },
  { slug: "kirisame-2", name: "Kirisame Magic Shop II", smallBlind: 25, bigBlind: 50 },
  { slug: "scarlet-1", name: "Scarlet Devil Mansion", smallBlind: 100, bigBlind: 200 },
  { slug: "gensokyo-high", name: "Gensokyo High", smallBlind: 500, bigBlind: 1000 },
];

const SEATS = 6;
// the ordinary live-room bounds: deep enough to play, shallow enough that one whale
// cannot make a table unjoinable
const MIN_BB = 20;
const MAX_BB = 200;

async function seed() {
  const writes = TABLES.map((t) => ({
    updateOne: {
      filter: { slug: t.slug },
      update: {
        // seats and pool are only set on insert: a rerun must never wipe a live table
        $setOnInsert: { seats: blankSeats(SEATS), pool: [], handNumber: 0, button: 0 },
        $set: {
          name: t.name,
          seatCount: SEATS,
          smallBlind: t.smallBlind,
          bigBlind: t.bigBlind,
          minBuyIn: t.bigBlind * MIN_BB,
          maxBuyIn: t.bigBlind * MAX_BB,
          active: true,
        },
      },
      upsert: true,
    },
  }));
  const res = await PokerTable.bulkWrite(writes, { ordered: false });
  return { upserted: res.upsertedCount || 0, matched: res.matchedCount || 0 };
}

if (require.main === module) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(seed)
    .then((r) => {
      console.log(`poker tables: ${r.upserted} created, ${r.matched} already there`);
      return mongoose.disconnect();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seed, TABLES, SEATS, MIN_BB, MAX_BB };
