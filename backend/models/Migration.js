const mongoose = require("mongoose");

// one row per one-off data change that has run, so a boot never runs it twice
const MigrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  ranAt: { type: Date, default: Date.now },
  touched: Number,
});

module.exports = mongoose.model("Migration", MigrationSchema);
