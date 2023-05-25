const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  googleId: {
    type: String,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
  },
  walletBalance: {
    type: Number,
    default: 0,
  },
  inventory: [
    {
      _id: mongoose.Schema.Types.ObjectId,
      name: String,
      image: String,
      rarity: String,
      case: mongoose.Schema.Types.ObjectId,
    },
  ],
  fixedItem: {
    name: String,
    image: String,
    rarity: String,
    description: String,
  },
  xp: {
    type: Number,
    default: 0,
  },
  level: {
    type: Number,
    default: 0,
  },
  profilePicture: {
    type: String,
    default: "", // default "" to a default image URL
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  nextBonus: {
    type: Date,
    default: Date.now, // sets default time to current time
  },
  bonusAmount: {
    type: Number,
    default: 1000, // sets the initial bonus amount to 1000
  },

});

module.exports = User = mongoose.model("User", UserSchema);
