// a request budget per account, spent once the token checks out and before the account is read: every authenticated
// request reads the account, so a refused flood used to cost a database read per request anyway (2026-10-23)
const BURST = 40;
const PER_SECOND = 10;

function makeBudget({ burst = BURST, perSecond = PER_SECOND } = {}) {
  const buckets = new Map();
  const refilled = (b, now) => Math.min(burst, b.tokens + ((now - b.at) / 1000) * perSecond);

  // a bucket that has filled back up is the same as no bucket, so idle accounts are not kept forever
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (refilled(b, now) >= burst) buckets.delete(key);
  }, 60 * 1000);
  if (sweep.unref) sweep.unref();

  return {
    spend(key, now = Date.now()) {
      const b = buckets.get(key) || { tokens: burst, at: now };
      b.tokens = refilled(b, now);
      b.at = now;
      buckets.set(key, b);
      if (b.tokens < 1) return false;
      b.tokens -= 1;
      return true;
    },
  };
}

// tests fire bursts from one account on purpose, the way the rate limiters skip there
const accountBudget = process.env.NODE_ENV === "test" ? { spend: () => true } : makeBudget();

module.exports = { makeBudget, accountBudget, BURST, PER_SECOND };
