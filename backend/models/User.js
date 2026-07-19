const uuid = require('uuid');
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
  // bumped to invalidate every token issued so far (logout everywhere, password change)
  tokenVersion: {
    type: Number,
    default: 0,
  },
  walletBalance: {
    type: Number,
    default: 200,
  },
  inventory: [
    {
      uniqueId: {
        type: String,
        default: () => uuid.v4(),
      },
      _id: mongoose.Schema.Types.ObjectId,
      name: String,
      image: String,
      rarity: String,
      case: mongoose.Schema.Types.ObjectId,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  fixedItem: {
    name: String,
    image: String,
    rarity: String,
    description: String,
  },
  friends: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  friendRequests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
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
    default: () => Date.now() - 86400000 // now - 24 hours
  },
  bonusAmount: {
    type: Number,
    default: 1000, // sets the initial bonus amount to 1000
  },
  weeklyWinnings: {
    type: Number,
    default: 0,
  },
  lastWinningsUpdate: {
    type: Date,
    default: Date.now,
  },
  // affiliate identity: the vanity code others register with, set once
  referralCode: {
    type: String,
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  // commission already paid out, so available = earned - claimed stays ledger-derived
  referralClaimed: {
    type: Number,
    default: 0,
  },
  // the level-10 reward went to this user's referrer; set once, never unset
  referralMilestonePaid: {
    type: Boolean,
    default: false,
  },

});

UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
UserSchema.index({ referredBy: 1 }, { sparse: true });
UserSchema.index({ weeklyWinnings: -1 }); // leaderboard, ranking window, weekly cron

module.exports = User = mongoose.model("User", UserSchema);
