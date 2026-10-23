// one bet at a time per player. an auto run firing faster than atlas answered raced its own wallet into write conflicts,
// and mongo retried each for up to two minutes, which slowed every player on the site; the api is a single process, so a map is enough
const MAX_WAITING = 16;
// a request that never answers must not hold the player's lane for good
const RELEASE_AFTER_MS = 30000;
// and one bet a second at most: two auto runs at three a second were filling the free database tier's writes and storage
const BET_GAP_MS = 1000;

// in tests the routes run unpaced, the way the rate limiters skip there; the pacing has its own test
function makeLane({ gapMs = process.env.NODE_ENV === "test" ? 0 : BET_GAP_MS } = {}) {
  const lanes = new Map();

  return function oneAtATime(req, res, next) {
    const key = String(req.user._id);
    let lane = lanes.get(key);
    if (!lane) {
      lane = { tail: Promise.resolve(), waiting: 0, lastStart: 0 };
      lanes.set(key, lane);
    }
    if (lane.waiting >= MAX_WAITING) {
      return res.status(429).json({ message: "Your last bets are still settling, slow down a little." });
    }
    lane.waiting += 1;

    // a response that closes before its turn means the player left; that bet is never placed
    let gone = false;
    const leave = () => (gone = true);
    res.once("close", leave);

    let release;
    const turnDone = new Promise((resolve) => (release = resolve));
    const ahead = lane.tail;
    lane.tail = ahead.then(() => turnDone);

    ahead
      .then(() => {
        const wait = lane.lastStart + gapMs - Date.now();
        return wait > 0 ? new Promise((resolve) => setTimeout(resolve, wait)) : null;
      })
      .then(() => {
        res.off("close", leave);
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          lane.waiting -= 1;
          // kept for one gap after its last bet, so a bet sent the moment that one answered still waits its turn
          if (lane.waiting === 0) {
            setTimeout(() => lane.waiting === 0 && lanes.get(key) === lane && lanes.delete(key), gapMs);
          }
          release();
        };
        const timer = setTimeout(finish, RELEASE_AFTER_MS);
        if (gone) return finish();
        lane.lastStart = Date.now();
        res.on("finish", finish);
        res.on("close", finish);
        next();
      });
  };
}

const oneAtATime = makeLane();

module.exports = { oneAtATime, makeLane, MAX_WAITING, BET_GAP_MS };
