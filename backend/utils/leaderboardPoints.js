const { TX } = require("./economy");

// what a wagered KP is worth in race points, by game. the multiplier tracks the house
// edge: a game that earns the house more pays the player more points, which is the only
// honest way to rank play across games whose edges run from 0.5% to whatever a case is.
//
// this replaced weeklyWinnings, which was never one measurement. crash and coin flip fed
// it `payout - bet` while dice, plinko, mines, hilo, slots and blackjack fed it the whole
// payout, so a near-even-money dice win scored its entire stake as "winnings" and a bot
// grinding the lowest-edge game on the site topped the board. points are wagered-based,
// so luck cannot move them and every game is measured the same way.
const MULTIPLIERS = {
  [TX.CASE_OPEN]: 1.5, // the widest-played game, and the biggest margin
  [TX.BATTLE_ENTRY]: 1.5,
  [TX.CRASH_BET]: 1.3, // 3.97%
  [TX.SLOT_BET]: 1.15, // 3.55%
  [TX.PLINKO_BET]: 1.15, // ~3.5%
  [TX.COINFLIP_BET]: 1.0, // 3%, the baseline
  [TX.MINES_BET]: 0.4, // 1%
  [TX.HILO_BET]: 0.4, // 1%
  [TX.DICE_BET]: 0.4, // 1%
  [TX.BLACKJACK_BET]: 0.4, // 0.5% played correctly
  [TX.PREDICTION_BUY]: 0.3, // a market against the house, not a house game
};

// the order the "what are points?" table reads in, highest first
const TABLE = [
  { type: TX.CASE_OPEN, key: "caseOpening", edge: null },
  { type: TX.BATTLE_ENTRY, key: "battles", edge: null },
  { type: TX.CRASH_BET, key: "crash", edge: 3.97 },
  { type: TX.SLOT_BET, key: "slots", edge: 3.55 },
  { type: TX.PLINKO_BET, key: "plinko", edge: 3.5 },
  { type: TX.COINFLIP_BET, key: "coinFlip", edge: 3.0 },
  { type: TX.MINES_BET, key: "mines", edge: 1.0 },
  { type: TX.HILO_BET, key: "hilo", edge: 1.0 },
  { type: TX.DICE_BET, key: "dice", edge: 1.0 },
  { type: TX.BLACKJACK_BET, key: "blackjack", edge: 0.5 },
  { type: TX.PREDICTION_BUY, key: "predictions", edge: null },
];

// only these ledger rows score. upgrade stakes items rather than KP and mints no row at
// all; marketplace trades and the bonus are not bets and must never count.
const SCORING_TYPES = Object.keys(MULTIPLIERS);

// points are whole: a fractional score would show as 1,240.4 on a board and mean nothing
const pointsFor = (type, amount) => {
  const multiplier = MULTIPLIERS[type];
  if (!multiplier || !(amount > 0)) return 0;
  return Math.floor(amount * multiplier);
};

// the $switch the standings aggregate scores with, built from the same table, so the
// board and `pointsFor` can never drift apart
const pointsExpression = () => ({
  $floor: {
    $multiply: [
      "$amount",
      {
        $switch: {
          branches: SCORING_TYPES.map((type) => ({
            case: { $eq: ["$type", type] },
            then: MULTIPLIERS[type],
          })),
          default: 0,
        },
      },
    ],
  },
});

module.exports = { MULTIPLIERS, TABLE, SCORING_TYPES, pointsFor, pointsExpression };
