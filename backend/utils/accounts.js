const mongoose = require("mongoose");

// system accounts are bare ObjectId constants, never User docs, so they cannot leak
// into topPlayers / ranking / the leaderboard cron, which all query the User collection
const HOUSE = new mongoose.Types.ObjectId("000000000000000000000000"); // edge revenue
const MINT = new mongoose.Types.ObjectId("000000000000000000000001"); // issuance faucet
const ESCROW = new mongoose.Types.ObjectId("000000000000000000000002"); // buy-order float
const GENESIS = new mongoose.Types.ObjectId("000000000000000000000003"); // pre-ledger plug

const SYSTEM_IDS = [HOUSE, MINT, ESCROW, GENESIS].map(String);
const isSystemAccount = (id) => SYSTEM_IDS.includes(String(id));

// the account a movement settles against, keyed by transaction type. market trades are
// player to player and self-balance across their own legs, so they carry no counterparty.
const COUNTERPARTY_FOR_TYPE = {
  signup: MINT,
  bonus: MINT,
  mission_reward: MINT,
  referral_bonus: MINT,
  referral_milestone: MINT,
  ad_reward: MINT, // KP printed against outside ad revenue

  referral_commission: HOUSE, // the house shares its edge with the affiliate
  admin_adjust: MINT,
  case_open: HOUSE,
  slot_bet: HOUSE,
  slot_win: HOUSE,
  crash_bet: HOUSE,
  crash_cashout: HOUSE,
  crash_refund: HOUSE,
  coinflip_bet: HOUSE,
  coinflip_win: HOUSE,
  coinflip_refund: HOUSE,
  battle_entry: HOUSE,
  battle_refund: HOUSE,
  item_sell: HOUSE,
  market_order: ESCROW,
  market_order_refund: ESCROW,
  opening_balance: GENESIS,
};

module.exports = {
  HOUSE,
  MINT,
  ESCROW,
  GENESIS,
  SYSTEM_IDS,
  isSystemAccount,
  COUNTERPARTY_FOR_TYPE,
};
