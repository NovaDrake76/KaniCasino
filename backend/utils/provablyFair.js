const crypto = require("crypto");

// the roll space. every game maps a roll in [1, TOTAL] to an outcome; case items
// partition [1, TOTAL] into contiguous ranges (skin.club-style: 1..100000).
const TOTAL = 100_000;

// number of digest bytes folded into the [0,1) float. 4 bytes (32 bits) is the
// widely-implemented "stake" standard so any third-party tool reproduces the roll.
const FLOAT_BYTES = 4;

function generateServerSeed() {
  return crypto.randomBytes(32).toString("hex");
}

// the public commitment shown before any roll; sha256(serverSeed).
function hashServerSeed(serverSeed) {
  return crypto.createHash("sha256").update(serverSeed).digest("hex");
}

function generateClientSeed() {
  return crypto.randomBytes(16).toString("hex");
}

// HMAC-SHA256(key=serverSeed, msg=`${clientSeed}:${nonce}:${cursor}`) folded into a
// uniform float in [0,1) from the first FLOAT_BYTES bytes. `cursor` yields extra
// independent draws under one nonce (e.g. the 9 slot reels).
function rollFloat(serverSeed, clientSeed, nonce, cursor = 0) {
  const digest = crypto
    .createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${nonce}:${cursor}`)
    .digest();

  let result = 0;
  for (let i = 0; i < FLOAT_BYTES; i++) {
    result += digest[i] / 256 ** (i + 1);
  }
  return result; // [0, 1)
}

// map a [0,1) float to an integer roll in [1, total].
function toRollInt(float, total = TOTAL) {
  return Math.floor(float * total) + 1;
}

// convenience: the integer roll for a single draw.
function roll(serverSeed, clientSeed, nonce, { total = TOTAL, cursor = 0 } = {}) {
  return toRollInt(rollFloat(serverSeed, clientSeed, nonce, cursor), total);
}

// given an ascending rangeTable of { start, end, ... } covering [1, total], return
// the entry whose [start, end] contains rollInt (binary search).
function pickFromRanges(rollInt, rangeTable) {
  let lo = 0;
  let hi = rangeTable.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = rangeTable[mid];
    if (rollInt < r.start) hi = mid - 1;
    else if (rollInt > r.end) lo = mid + 1;
    else return r;
  }
  // ranges always cover [1, total], so this is only reached on a malformed table
  return rangeTable[rangeTable.length - 1] || null;
}

module.exports = {
  TOTAL,
  FLOAT_BYTES,
  generateServerSeed,
  hashServerSeed,
  generateClientSeed,
  rollFloat,
  toRollInt,
  roll,
  pickFromRanges,
};
