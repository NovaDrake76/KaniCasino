const crypto = require("crypto");

// the result is derived by an hmac KEYED with the seed, not by sha256(seed): the round's
// published commitment is sha256(seed), so deriving the result from that same hash let
// anyone read the winning side off the commitment before betting closed. hmac(seed,
// "coinflip") needs the still-secret seed, so it stays unknowable until reveal while
// sha256(seed) still verifies the chain link. 0 (heads) or 1 (tails), a fair 50/50.
const coinResultFromSeed = (serverSeed) => {
  const hash = crypto.createHmac("sha256", serverSeed).update("coinflip").digest("hex");
  return parseInt(hash.slice(0, 8), 16) % 2;
};

module.exports = { coinResultFromSeed };
