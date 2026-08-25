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
    // the character, not the item: pinning an alt outfit makes you a fan of the person, so
    // this holds the base name and every board lookup keeps working off the same index
    name: String,
    // which outfit was pinned, when it was not the base one. display only
    variant: String,
    image: String,
    rarity: String,
    description: String,
  },
  // when the current character was pinned, so a tie on a fan board goes to whoever
  // committed first rather than to whichever document mongo happened to return
  fixedAt: Date,
  // rebuilt by the fandom sweep, never written by hand. rank 1 is what earns the badge.
  fanRank: {
    name: String,
    image: String,
    rarity: String,
    count: Number,
    rank: Number,
    fans: Number,
    // the runner-up's count and when this player pinned, so a profile can show the gap
    // and the standing without going back to the board
    second: Number,
    since: Date,
  },
  collectionRank: {
    distinct: Number,
    total: Number,
    rank: Number,
  },
  // which sweep last saw this account, so the next one can clear whoever it did not touch
  fanStamp: Date,
  // earned or granted badges. top fan is not here: it is derived from fanRank, because
  // it can be taken off a player the moment someone outcollects them.
  badges: [
    {
      _id: false,
      key: { type: String, required: true },
      awardedAt: { type: Date, default: Date.now },
      note: String,
      // the human name behind a keyed badge, so a collection one can be shown without
      // looking its category up again
      label: String,
    },
  ],
  // the one badge the player wears around the site. nothing shows until they pick one.
  selectedBadge: String,
  // which look the shared fan card uses. validated on read, because the poster styles
  // are only open while the player still leads a board.
  cardStyle: String,
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
  // whatever the account started with, a google picture or the placeholder, kept so an
  // item avatar can always be undone without guessing which one they came from
  basePicture: {
    type: String,
    default: "",
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  // a disabled account keeps its rows so the ledger and every board stay consistent, but
  // nothing it holds can be used again. banning by deletion would tear holes in both.
  disabled: {
    type: Boolean,
    default: false,
  },
  disabledAt: Date,
  disabledReason: String,
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

  // marketing consent is opt-in and defaults to off: nobody who signed up before it
  // existed is treated as having agreed. service mail does not consult it.
  marketingOptIn: {
    type: Boolean,
    default: false,
  },
  marketingOptInAt: Date,
  // secret in the one-click unsubscribe link, so it works without a login
  unsubscribeToken: {
    type: String,
    default: () => uuid.v4(),
  },
  // set by the SES bounce/complaint feed; nothing is ever sent to a suppressed address
  emailSuppressed: {
    type: Boolean,
    default: false,
  },
  emailSuppressedReason: String,
  emailSuppressedAt: Date,

  // the linked discord account. set only by the bot's link flow, which needs a logged-in
  // session on the site, so a discord id can never claim an account on its own.
  discordId: String,
  discordName: String,
  discordLinkedAt: Date,
  // the servers this player has actually used the bot in, which is what a per-server board
  // counts. it holds who plays, not who is a member, so no privileged intent is needed.
  discordGuilds: [String],

  // the daily gift. one spin every 24h; the streak tilts the odds toward the rarer
  // slots and resets the moment a calendar day is missed.
  giftNextAt: Date,
  giftLastAt: Date,
  giftStreak: {
    type: Number,
    default: 0,
  },
  // free openings of one specific case. the grant is per case, never per category, so a
  // cheap win cannot be spent on the dearest thing in the same theme.
  freeOpens: [
    {
      grantId: { type: String, default: () => uuid.v4() },
      caseId: { type: mongoose.Schema.Types.ObjectId, ref: "Case", required: true },
      remaining: { type: Number, required: true, min: 0 },
      wonAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true },
    },
  ],

});

UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
UserSchema.index({ referredBy: 1 }, { sparse: true });
UserSchema.index({ weeklyWinnings: -1 }); // leaderboard, ranking window, weekly cron
UserSchema.index({ "fixedItem.name": 1 }, { sparse: true }); // fan board recount on pin
UserSchema.index({ discordId: 1 }, { unique: true, sparse: true }); // bot lookups, one account per discord user
UserSchema.index({ discordGuilds: 1 }, { sparse: true }); // per-server boards

module.exports = User = mongoose.model("User", UserSchema);
