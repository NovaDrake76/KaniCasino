const GameSeedChain = require("../models/GameSeedChain");
const { generateChain } = require("./hashChain");

const CHAIN_LENGTH = 10000; // seeds per chain; a new commitment is published on rotation

function createChain(game) {
  const { seeds, terminalHash } = generateChain(CHAIN_LENGTH);
  return GameSeedChain.create({ game, seeds, terminalHash, cursor: 0, active: true });
}

// atomically take the next seed from the active chain, rotating to a fresh one when it is
// exhausted. the seed stays server-side until the round reveals it.
async function consumeNextSeed(game) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const claimed = await GameSeedChain.findOneAndUpdate(
      { game, active: true, $expr: { $lt: ["$cursor", { $size: "$seeds" }] } },
      { $inc: { cursor: 1 } },
      { new: false, projection: { seeds: 0 } }
    );
    if (claimed) {
      const index = claimed.cursor; // the pre-increment value is the one we claimed
      const doc = await GameSeedChain.findById(claimed._id, { seeds: { $slice: [index, 1] } });
      return { chainId: claimed._id, terminalHash: claimed.terminalHash, index, seed: doc.seeds[0] };
    }
    // none active, or the active one is spent: retire it and publish a fresh commitment
    await GameSeedChain.updateMany({ game, active: true }, { $set: { active: false } });
    await createChain(game);
  }
  throw new Error(`could not consume a ${game} seed`);
}

module.exports = { CHAIN_LENGTH, createChain, consumeNextSeed };
