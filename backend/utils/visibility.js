// a disabled account is frozen, not deleted. its rows stay put so the ledger, past battles
// and market history all remain whole, and nothing that already happened is rewritten.
//
// but it must not appear anywhere a player browses. that is the whole point of the ban:
// the account was disabled because its name is the problem, so leaving the name on a
// leaderboard would defeat it.
//
// every public query composes this in. one constant rather than a filter written out at
// each call site, so a surface that forgets it is visible in a grep rather than invisible.
const VISIBLE = { disabled: { $ne: true } };

// merge into an existing filter. `{ ...filter, ...VISIBLE }` is safe here because no
// caller filters on `disabled` itself.
const visible = (filter = {}) => ({ ...filter, ...VISIBLE });

// for a single document already loaded
const isVisible = (user) => !!user && user.disabled !== true;

module.exports = { VISIBLE, visible, isVisible };
