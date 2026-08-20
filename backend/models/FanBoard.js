const mongoose = require("mongoose");

// one board per character. the whole thing is rebuilt from scratch by the fandom sweep,
// so nothing here is ever edited in place and nothing outside the sweep writes to it.
const FanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: String,
    profilePicture: String,
    level: Number,
    count: { type: Number, required: true },
    since: Date,
  },
  { _id: false }
);

const FanBoardSchema = new mongoose.Schema({
  // the item name is the character: the same character in two cases is two item rows
  // with one name, which is exactly the grouping the board wants
  name: { type: String, required: true, unique: true, index: true },
  image: String,
  rarity: String,
  // the case this character drops from, so a board can point straight at it
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case" },
  // how many people have this character pinned, whether or not they hold any
  fanCount: { type: Number, default: 0 },
  // the leader's count, kept flat so browse can sort and filter on it
  topCount: { type: Number, default: 0 },
  // runner-up, and how far clear the leader is. a board nobody is chasing carries the
  // sentinel so it sorts last on the contested tab instead of looking like a dead heat.
  secondCount: { type: Number, default: 0 },
  gap: { type: Number, default: 999999 },
  top: FanSchema,
  ranks: [FanSchema],
  updatedAt: { type: Date, default: Date.now },
});

// the browse page sorts by these
FanBoardSchema.index({ fanCount: -1 });
FanBoardSchema.index({ topCount: -1 });
FanBoardSchema.index({ gap: 1 });

module.exports = mongoose.model("FanBoard", FanBoardSchema);
