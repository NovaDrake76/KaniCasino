// the table's item cage. items enter at buy-in, sit here for the whole session, and leave
// only when somebody spends chips redeeming them at cash-out. nothing here runs during a
// hand, which is what makes chip conservation true by construction: chips are the only
// thing that moves while cards are out.
//
// a pool entry: { uniqueId, itemId, name, image, rarity, value, stakedBy (seat), userId }

const byValueDesc = (a, b) => b.value - a.value || String(a.uniqueId).localeCompare(String(b.uniqueId));

const stakedBy = (pool, seat) => pool.filter((entry) => entry.stakedBy === seat);

const totalValue = (entries) => entries.reduce((sum, e) => sum + e.value, 0);

// greedily fit a seat's own items into the chips it has, most valuable first. descending
// order is the whole point: the cheap item is the first thing you cannot afford, so a
// legendary is the last thing you lose.
function splitAffordable(entries, chips) {
  const safe = [];
  const risk = [];
  let left = chips;
  for (const entry of entries.slice().sort(byValueDesc)) {
    if (entry.value <= left) {
      safe.push(entry);
      left -= entry.value;
    } else {
      risk.push(entry);
    }
  }
  return { safe, risk, leftover: left };
}

// what this seat can still redeem of their own stake
const safeFor = (pool, seat, chips) => splitAffordable(stakedBy(pool, seat), chips).safe;

// what this seat staked and can no longer afford. these are the ones on the line.
const atRiskFor = (pool, seat, chips) => splitAffordable(stakedBy(pool, seat), chips).risk;

// every at-risk item on the table, from every seat, given a map of seat -> chips. a seat
// with no chips entry is treated as gone, so everything they staked is open.
function atRiskAll(pool, chipsBySeat) {
  const seats = [...new Set(pool.map((e) => e.stakedBy))];
  return seats.flatMap((seat) => atRiskFor(pool, seat, chipsBySeat[seat] || 0));
}

// items this seat may take, in the order the ui should offer them: their own affordable
// stake first (right of first refusal), then anything another seat can no longer cover.
function redeemable(pool, seat, chips, chipsBySeat) {
  const mine = splitAffordable(stakedBy(pool, seat), chips);
  const openToAll = atRiskAll(pool, chipsBySeat).filter((e) => e.stakedBy !== seat);
  return { reserved: mine.safe, open: openToAll.sort(byValueDesc), spare: mine.leftover };
}

// spend `chips` on items and take the rest in kp. `picks` is an optional list of uniqueIds
// the player chose; anything affordable and not picked is skipped. their own affordable
// items are taken first by default, because leaving your own stake behind is never what
// somebody meant to do.
function redeem(pool, seat, chips, picks) {
  const wanted = picks ? new Set(picks.map(String)) : null;
  const { reserved, open } = redeemable(pool, seat, chips, {});

  const taken = [];
  let left = chips;

  const take = (entry) => {
    if (entry.value > left) return;
    taken.push(entry);
    left -= entry.value;
  };

  for (const entry of reserved) {
    if (!wanted || wanted.has(String(entry.uniqueId))) take(entry);
  }
  if (wanted) {
    for (const entry of open) {
      if (wanted.has(String(entry.uniqueId))) take(entry);
    }
  }

  const takenIds = new Set(taken.map((e) => String(e.uniqueId)));
  return {
    items: taken,
    kp: left,
    remaining: pool.filter((e) => !takenIds.has(String(e.uniqueId))),
  };
}

// the invariant, asserted after every settlement in tests and behind a flag in production
function conserves({ buyIns, stacks, rakeTaken }) {
  const staked = buyIns.reduce((sum, v) => sum + v, 0);
  const held = stacks.reduce((sum, v) => sum + v, 0);
  return staked === held + rakeTaken;
}

module.exports = {
  byValueDesc,
  stakedBy,
  totalValue,
  splitAffordable,
  safeFor,
  atRiskFor,
  atRiskAll,
  redeemable,
  redeem,
  conserves,
};
