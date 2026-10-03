// short-lived copies of the public reads every visitor asks for: atlas gives this box about 90 KB a second, so re-reading a 30 to 110 KB answer per page view queues everyone behind it.
// a write forgets the copy; the ttl only bounds what a write from outside this process could leave stale.
const MAX_ENTRIES = 500;
const RETRY_MS = 5000;

const entries = new Map();
const inflight = new Map();
// bumped by every forget, so a read that started before a write cannot store what it saw
let version = 0;

function store(key, value) {
  entries.delete(key);
  entries.set(key, { value, at: Date.now(), triedAt: 0 });
  // the map keeps insertion order, so the first key is the one written longest ago
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value);
}

// one load per key at a time: a cold copy under load must not send the same read several times
function load(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const started = version;
  let read;
  try {
    read = Promise.resolve(fn());
  } catch (err) {
    read = Promise.reject(err);
  }
  const promise = read
    .then((value) => {
      if (version === started) store(key, value);
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

// a fresh copy is returned as is; an expired one is returned while the refresh runs behind it,
// so only the first reader of a key, or the first after a write, ever waits on atlas
async function remember(key, ttlMs, fn) {
  const entry = entries.get(key);
  if (!entry) return load(key, fn);
  const now = Date.now();
  if (now - entry.at >= ttlMs && !inflight.has(key) && now - entry.triedAt >= RETRY_MS) {
    entry.triedAt = now;
    load(key, fn).catch(() => {}); // stale is still better than making the caller wait
  }
  return entry.value;
}

function forget(prefix) {
  version += 1;
  for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
  for (const key of [...inflight.keys()]) if (key.startsWith(prefix)) inflight.delete(key);
}

const clear = () => {
  version += 1;
  entries.clear();
  inflight.clear();
};

module.exports = { remember, forget, clear, MAX_ENTRIES };
