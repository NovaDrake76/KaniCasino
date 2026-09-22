// daisu's shop: an unlock opens a feature, a boost adds to the xp every bet earns, a charm adds to it on one game. every price is a sink to the mint
// one ladder, in level order whatever the kind: each item about what a player of that level has, so the next one is always just out of reach
const CHARM_XP = 0.25;
// the charms climb the ladder with the rest, the cheap games first
const CHARMS = [
  ["dice", 3, 1000], ["slots", 5, 1500], ["coinflip", 7, 2500], ["plinko", 9, 3500], ["crash", 11, 5000],
  ["mines", 14, 8000], ["hilo", 17, 12000], ["blackjack", 20, 20000], ["cases", 24, 40000], ["battles", 28, 80000],
];
const CHARM_GAMES = CHARMS.map(([game]) => game);

const ITEMS = [
  // unlocks and perks
  { key: "spyglass", kind: "unlock", price: 500, level: 3 },
  { key: "chatPass", kind: "unlock", price: 1000, level: 10 },
  { key: "tradersLicense", kind: "unlock", price: 3000, level: 10 },
  { key: "collectionBook", kind: "unlock", price: 6000, level: 10 },
  { key: "affiliateCard", kind: "unlock", price: 10000, level: 10 },
  { key: "predictionPass", kind: "unlock", price: 15000, level: 15 },
  { key: "giftCharm", kind: "unlock", price: 40000, level: 20 },
  { key: "merchantSeal", kind: "unlock", price: 150000, level: 30 },
  { key: "goldenTicket", kind: "unlock", price: 400000, level: 40 },
  { key: "rainCoat", kind: "unlock", price: 800000, level: 50 },
  // the boosts: things from her desk, one every few levels
  { key: "luckyPencil", kind: "boost", price: 300, level: 2, xp: 0.05 },
  { key: "pocketNotebook", kind: "boost", price: 800, level: 4, xp: 0.05 },
  { key: "readingLamp", kind: "boost", price: 2000, level: 6, xp: 0.1 },
  { key: "coffeeMug", kind: "boost", price: 4000, level: 8, xp: 0.1 },
  { key: "abacus", kind: "boost", price: 8000, level: 12, xp: 0.1 },
  { key: "fortuneCat", kind: "boost", price: 15000, level: 15, xp: 0.15 },
  { key: "studyDesk", kind: "boost", price: 30000, level: 18, xp: 0.15 },
  { key: "metronome", kind: "boost", price: 60000, level: 22, xp: 0.15 },
  { key: "hourglass", kind: "boost", price: 120000, level: 26, xp: 0.2 },
  { key: "globe", kind: "boost", price: 250000, level: 30, xp: 0.2 },
  { key: "telescope", kind: "boost", price: 500000, level: 35, xp: 0.25 },
  { key: "goldCat", kind: "boost", price: 1000000, level: 40, xp: 0.25 },
  { key: "libraryCard", kind: "boost", price: 2000000, level: 45, xp: 0.25 },
  { key: "compass", kind: "boost", price: 4000000, level: 50, xp: 0.3 },
  { key: "crystalSkull", kind: "boost", price: 8000000, level: 55, xp: 0.3 },
  { key: "daisuDiary", kind: "boost", price: 15000000, level: 60, xp: 0.3 },
  { key: "starChart", kind: "boost", price: 30000000, level: 65, xp: 0.35 },
  { key: "goldenAbacus", kind: "boost", price: 60000000, level: 70, xp: 0.35 },
  { key: "observatory", kind: "boost", price: 150000000, level: 80, xp: 0.4 },
  { key: "philosopherStone", kind: "boost", price: 400000000, level: 90, xp: 0.5 },
  // the charms: one per game, worn on that game's bets only
  ...CHARMS.map(([game, level, price]) => ({ key: `${game}Charm`, kind: "charm", price, level, xp: CHARM_XP, game })),
].sort((a, b) => a.level - b.level || a.price - b.price);

// the shelf shows what is held plus this many of the items after it, in order; the rest stay a mystery until something is bought
const REVEAL_AHEAD = 8;
// what the perks are worth: the charm leans the daily gift like the discord boost does, the seal is the fee its holder's
// sales pay, the ticket's share of a take, the coat's extra weight in a rain
const GIFT_CHARM_TILT = 0.05;
const SEAL_FEE_RATE = 0.02;
const GOLDEN_TICKET_SHARE = 0.15;
const RAIN_COAT_WEIGHT = 1.5;

const itemOf = (key) => ITEMS.find((item) => item.key === key) || null;

// the account's xp multipliers from what it holds: `all` is one plus every boost, a game key is its charm. a sum,
// never an increment, so it can always be recomputed from the unlocks
const boostsOf = (keys) => {
  const held = ITEMS.filter((item) => keys.includes(item.key));
  const out = { all: 1 + held.filter((i) => i.kind === "boost").reduce((sum, i) => sum + i.xp, 0) };
  for (const charm of held.filter((i) => i.kind === "charm")) out[charm.game] = charm.xp;
  out.all = Math.round(out.all * 100) / 100;
  return out;
};

module.exports = { ITEMS, itemOf, boostsOf, CHARM_GAMES, CHARM_XP, REVEAL_AHEAD, GIFT_CHARM_TILT, SEAL_FEE_RATE, GOLDEN_TICKET_SHARE, RAIN_COAT_WEIGHT };
