const Item = require("../models/Item");

// the item catalog is reference data: it changes when an admin edits an item and at no
// other time, but the market grid was re-reading all of it on every request. that is a
// half-megabyte fetch to atlas per page view, and atlas is the slowest thing we have.
const TTL_MS = 5 * 60 * 1000;

let cached = null;
let loadedAt = 0;
let inflight = null;
// bumped on every load, so anything derived from the catalog can tell it has turned over
// without comparing clocks two loads could share
let generation = 0;

function invalidate() {
  cached = null;
  loadedAt = 0;
}

// a cache the writers have to remember to clear goes stale the first time somebody adds a
// route, so `models/Item.js` clears it on every write instead of the call sites doing it.
// bulkWrite fires no hook and calls invalidate() by hand.

// one loader shared by concurrent callers: a cold cache under load must not send the same
// half-megabyte query several times over
function load() {
  if (!inflight) {
    inflight = Item.find({})
      .lean()
      .then((items) => {
        cached = items;
        loadedAt = Date.now();
        generation += 1;
        inflight = null;
        return items;
      })
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
}

// how long a failed background refresh waits before it is worth trying again
const RETRY_MS = 5000;
let refreshedAt = 0;

// the ttl is a backstop, not correctness: a real write clears the cache outright, and only
// a write this process did not make can leave it stale. so an expired copy is served while
// the refresh runs behind it. blocking on it instead made one request every five minutes
// wait out the whole catalog read, which on this link is five seconds.
async function all() {
  if (cached) {
    const now = Date.now();
    if (now - loadedAt >= TTL_MS && now - refreshedAt >= RETRY_MS) {
      refreshedAt = now;
      load().catch(() => {}); // stale is still better than making the caller wait
    }
    return cached;
  }
  return load();
}

// the filters the market grid uses, matched in memory. name is a case-insensitive
// contains, the same thing the regex handed to mongo did.
async function find({ name, rarity, caseId } = {}) {
  const items = await all();
  const needle = name ? String(name).toLowerCase() : null;
  const wantCase = caseId ? String(caseId) : null;
  return items.filter((item) => {
    if (needle && !String(item.name || "").toLowerCase().includes(needle)) return false;
    if (rarity && String(item.rarity) !== String(rarity)) return false;
    if (wantCase && String(item.case) !== wantCase) return false;
    return true;
  });
}

// every catalog id mapped to the character behind it, rebuilt only when the cache turns over
let nameById = null;
let nameByIdFor = -1;
async function namesById() {
  const items = await all();
  if (!nameById || nameByIdFor !== generation) {
    nameById = new Map(items.map((item) => [String(item._id), item.name]));
    nameByIdFor = generation;
  }
  return nameById;
}

module.exports = { all, find, namesById, invalidate, TTL_MS };
