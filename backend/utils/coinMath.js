const crypto = require("crypto");

// the result is derived by an hmac KEYED with the seed, not by sha256(seed): the round's
// published commitment is sha256(seed), so deriving the result from that same hash let
// anyone read the winning side off the commitment before betting closed. hmac(seed,
// "coinflip") needs the still-secret seed, so it stays unknowable until reveal while
// sha256(seed) still verifies the chain link.
//
// version 1: 0 (heads) or 1 (tails), a fair 50/50.
// version 2: the same draw, but its lowest PURPLE_CHANCE of the 32-bit range lands 2 (purple)
// first. the parity of a uniform integer and where it sits in the range are independent, so
// heads and tails stay even with each other and every round from before the change verifies
// under its own version.
const PURPLE_CHANCE = 0.03;
const PURPLE_RESULT = 2;

const drawFromSeed = (serverSeed) => {
  const hash = crypto.createHmac("sha256", serverSeed).update("coinflip").digest("hex");
  return parseInt(hash.slice(0, 8), 16);
};

const coinResultFromSeed = (serverSeed, version = 1) => {
  const draw = drawFromSeed(serverSeed);
  if (version >= 2 && draw < PURPLE_CHANCE * 0x100000000) return PURPLE_RESULT;
  return draw % 2;
};

module.exports = { coinResultFromSeed, PURPLE_CHANCE, PURPLE_RESULT };
