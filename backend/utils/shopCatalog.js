// daisu's shop: each item opens one feature for accounts in her beta, once, for good, and its price is a sink: it goes to the mint and buys nothing but the unlock.
// prices climb like stairs, each about what the mission chapter before it pays; the license and the book together stay near what chapters one and two pay, because chapter three has missions that need both
const ITEMS = [
  { key: "chatPass", price: 1000, level: 10 },
  { key: "tradersLicense", price: 3000, level: 10 },
  { key: "collectionBook", price: 6000, level: 10 },
  { key: "affiliateCard", price: 10000, level: 10 },
  { key: "predictionPass", price: 15000, level: 15 },
  { key: "giftCharm", price: 40000, level: 20 },
  { key: "merchantSeal", price: 150000, level: 30 },
  // the long game: perks and trophies for the levels the chapters after five ask for
  { key: "goldenTicket", price: 400000, level: 40 },
  { key: "rainCoat", price: 800000, level: 50 },
  { key: "patronBadge", price: 1500000, level: 60, badge: "patron" },
  { key: "quickJar", price: 3000000, level: 75 },
  { key: "daisuCrown", price: 10000000, level: 100, badge: "crown" },
];

// the shelf shows what is held plus this many of the items after it, in order; the rest stay a mystery until something is bought
const REVEAL_AHEAD = 3;
// what the two perks are worth: the charm leans the daily gift like the discord boost does, the seal is the fee its holder's sales pay
const GIFT_CHARM_TILT = 0.05;
const SEAL_FEE_RATE = 0.02;
// the golden ticket's share of a take, the rain coat's extra weight in a rain, and the quick jar's cycle
const GOLDEN_TICKET_SHARE = 0.15;
const RAIN_COAT_WEIGHT = 1.5;
const QUICK_JAR_CYCLE_MS = 6 * 60000;

const itemOf = (key) => ITEMS.find((item) => item.key === key) || null;

module.exports = { ITEMS, itemOf, REVEAL_AHEAD, GIFT_CHARM_TILT, SEAL_FEE_RATE, GOLDEN_TICKET_SHARE, RAIN_COAT_WEIGHT, QUICK_JAR_CYCLE_MS };
