const crypto = require("crypto");

// the coin result derived from one seed so the round is verifiable: 0 (heads) or 1
// (tails) from a word of sha256(seed), a fair 50/50.
const coinResultFromSeed = (serverSeed) => {
  const hash = crypto.createHash("sha256").update(serverSeed).digest("hex");
  return parseInt(hash.slice(0, 8), 16) % 2;
};

module.exports = { coinResultFromSeed };
