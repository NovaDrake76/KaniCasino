const mongoose = require("mongoose");

// an item in the table's cage. it enters at buy-in, sits here for the whole session, and
// leaves only when somebody spends chips redeeming it. nothing moves it during a hand,
// which is what makes chip conservation true by construction.
const pooledItemSchema = new mongoose.Schema(
  {
    uniqueId: { type: String, required: true },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
    name: String,
    image: String,
    rarity: String,
    // sell value at the moment it was staked; it is redeemed at exactly this, never at a
    // later recomputed value, or the cage would stop conserving
    value: { type: Number, required: true },
    stakedBy: { type: Number, required: true }, // seat
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    stakedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const seatSchema = new mongoose.Schema(
  {
    seat: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    username: String,
    profilePicture: String,
    stack: { type: Number, default: 0 },
    // chips in the pot this street; totalCommitted is the whole hand
    committed: { type: Number, default: 0 },
    totalCommitted: { type: Number, default: 0 },
    // never emitted unredacted. see redactFor in games/poker.js
    holeCards: { type: [Number], default: [] },
    status: {
      type: String,
      enum: ["empty", "sitting", "active", "folded", "allin", "sittingout"],
      default: "empty",
    },
    // locked while seated; combined with every other seat's to key the hand's shuffle
    clientSeed: String,
    hasActed: { type: Boolean, default: false },
    canRaise: { type: Boolean, default: true },
    autoFolds: { type: Number, default: 0 },
    timeBankMs: { type: Number, default: 10000 },
    // a cash-out asked for mid-hand, honoured when the hand ends
    leaveAfterHand: { type: Boolean, default: false },
    joinedAt: Date,
  },
  { _id: false }
);

const potSchema = new mongoose.Schema(
  { amount: Number, eligible: [Number] },
  { _id: false }
);

const PokerTableSchema = new mongoose.Schema(
  {
    // fixed and always open: a lobby of empty player-made rooms reads as a dead game, and
    // a small set concentrates the players there are
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    seatCount: { type: Number, default: 6 },
    smallBlind: { type: Number, required: true },
    bigBlind: { type: Number, required: true },
    minBuyIn: { type: Number, required: true },
    maxBuyIn: { type: Number, required: true },
    active: { type: Boolean, default: true },

    seats: { type: [seatSchema], default: [] },
    pool: { type: [pooledItemSchema], default: [] },

    handNumber: { type: Number, default: 0 },
    button: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["idle", "dealing", "betting", "showdown", "settling"],
      default: "idle",
    },
    street: {
      type: String,
      enum: ["preflop", "flop", "turn", "river", null],
      default: null,
    },
    board: { type: [Number], default: [] },
    // the whole shuffled deck for the live hand. secret: it determines every hole card,
    // so it is stripped by redactFor exactly like the hole cards themselves.
    deck: { type: [Number], default: [] },
    pots: { type: [potSchema], default: [] },
    currentBet: { type: Number, default: 0 },
    minRaise: { type: Number, default: 0 },
    lastAggressor: { type: Number, default: null },
    toAct: { type: Number, default: null },
    actionDeadline: { type: Date, default: null },
    sawFlop: { type: Boolean, default: false },

    // every mutation is a compare-and-set on this
    actionSeq: { type: Number, default: 0 },

    // committed before the deal, revealed only once the hand is over: the deck falls out
    // of it, so an early reveal is a total break
    pfServerSeed: { type: String, default: null },
    pfServerSeedHash: { type: String, default: null },

    // settlement lease, so two boots cannot both finish the same hand
    lockedAt: { type: Date, default: null },
    lastHandAt: Date,
  },
  { timestamps: true }
);

PokerTableSchema.index({ active: 1, bigBlind: 1 });

module.exports = mongoose.model("PokerTable", PokerTableSchema);
