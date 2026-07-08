// pure helpers for case battles (no DB / no sockets), so the rules are testable.

// slots and team layout per mode. for free-for-all modes each player is their
// own team; 2v2 pairs slots 0+1 vs 2+3.
const MODES = {
  "1v1": { slots: 2, teams: [0, 1] },
  "1v1v1": { slots: 3, teams: [0, 1, 2] },
  "1v1v1v1": { slots: 4, teams: [0, 1, 2, 3] },
  "2v2": { slots: 4, teams: [0, 0, 1, 1] },
};

const modeConfig = (mode) => MODES[mode] || null;

// total base value accumulated per team
function teamTotals(players) {
  const totals = {};
  for (const p of players) {
    totals[p.team] = (totals[p.team] || 0) + (p.total || 0);
  }
  return totals;
}

// resolve the winning team and which teams tied for the top spot. highest total
// wins, or lowest in baka mode. ties are broken with rng (injectable for tests).
function evaluateWinner(players, bakaMode = false, rng = Math.random) {
  const totals = teamTotals(players);
  const teams = Object.keys(totals);
  if (!teams.length) return { winningTeam: null, tiedTeams: [] };

  const best = teams.reduce((acc, t) => {
    if (acc === null) return t;
    if (bakaMode) return totals[t] < totals[acc] ? t : acc;
    return totals[t] > totals[acc] ? t : acc;
  }, null);

  const bestVal = totals[best];
  const tiedTeams = teams.filter((t) => totals[t] === bestVal).map(Number);
  const winningTeam =
    tiedTeams.length === 1 ? tiedTeams[0] : tiedTeams[Math.floor(rng() * tiedTeams.length)];
  return { winningTeam, tiedTeams };
}

// the winning team index (see evaluateWinner).
function pickWinningTeam(players, bakaMode = false, rng = Math.random) {
  return evaluateWinner(players, bakaMode, rng).winningTeam;
}

// distribute a pool of items among N recipients as evenly as possible by value:
// sort by value desc, give each item to the recipient with the lowest running total.
function splitItemsEvenly(items, recipientCount) {
  const buckets = Array.from({ length: recipientCount }, () => ({ items: [], total: 0 }));
  if (recipientCount <= 0) return [];
  const sorted = [...items].sort((a, b) => (b.baseValue || 0) - (a.baseValue || 0));
  for (const item of sorted) {
    let lo = 0;
    for (let i = 1; i < buckets.length; i++) {
      if (buckets[i].total < buckets[lo].total) lo = i;
    }
    buckets[lo].items.push(item);
    buckets[lo].total += item.baseValue || 0;
  }
  return buckets.map((b) => b.items);
}

module.exports = { MODES, modeConfig, teamTotals, evaluateWinner, pickWinningTeam, splitItemsEvenly };
