const crypto = require("crypto");

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// build a chain where each seed is the hash of the next, so consuming them in order and
// revealing each proves the whole sequence, back to a terminal hash committed in advance.
function generateChain(length) {
  const seeds = new Array(length);
  seeds[length - 1] = crypto.randomBytes(32).toString("hex");
  for (let i = length - 2; i >= 0; i--) {
    seeds[i] = sha256(seeds[i + 1]);
  }
  // terminal = hash of the first seed to be consumed; it commits the entire chain
  const terminalHash = sha256(seeds[0]);
  return { seeds, terminalHash };
}

// every seed is the hash of the next, so the whole sequence regenerates from the last
// one. a retired chain keeps only that root instead of all ten thousand strings.
function seedAt(rootSeed, length, index) {
  let seed = rootSeed;
  for (let i = length - 1; i > index; i--) seed = sha256(seed);
  return seed;
}

// a revealed seed is valid if hashing it gives the previous reveal (or the terminal
// for the first round). this is the whole verification a player runs.
function linksTo(seed, priorHashOrTerminal) {
  return sha256(seed) === priorHashOrTerminal;
}

module.exports = { sha256, generateChain, linksTo, seedAt };
