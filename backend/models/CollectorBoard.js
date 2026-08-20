const mongoose = require("mongoose");

// the "most characters overall" board: one singleton document, rewritten by the fandom
// sweep. distinct characters is the score, total copies only breaks ties.
const CollectorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    username: String,
    profilePicture: String,
    level: Number,
    distinct: { type: Number, required: true },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const CollectorBoardSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: "collection" },
  // how many characters exist at all, so a profile can say "312 of 1224"
  characterCount: { type: Number, default: 0 },
  ranks: [CollectorSchema],
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CollectorBoard", CollectorBoardSchema);
