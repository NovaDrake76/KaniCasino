const mongoose = require("mongoose");

const CaseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  image: String,
  price: {
    type: Number,
    required: true,
  },

  items: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
    },
  ],
});

module.exports = mongoose.model("Case", CaseSchema);
