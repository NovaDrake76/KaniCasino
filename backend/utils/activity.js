// when each account last did something other than take the pot (utils/stillThere.js). kept in memory: the api is one process,
// and a restart only ever errs generous, since an account with no mark counts as active since the boot
let since = Date.now();
const last = new Map();

const mark = (userId, at = Date.now()) => {
  const key = String(userId);
  if ((last.get(key) || 0) < at) last.set(key, at);
};

const lastAt = (userId) => last.get(String(userId)) || since;

// for tests, which share one module instance
const reset = (bootAt = Date.now()) => {
  last.clear();
  since = bootAt;
};

module.exports = { mark, lastAt, reset };
