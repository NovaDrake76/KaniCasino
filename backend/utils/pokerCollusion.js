const PokerHand = require("../models/PokerHand");

// poker lets two accounts move chips at each other, and a dumped hand looks exactly like a
// folded one. that is not a new hole (the marketplace already moves items between any two
// players at any price, because the ceiling is gated behind REAL_MONEY_MODE) but it is an
// untraceable one, so the answer is detection rather than prevention.
//
// nothing here acts on its own. it surfaces pairs for a human to look at.

// how many hands a pair has to have played before their numbers mean anything
const MIN_HANDS = 20;
// how one-sided the flow has to be before it is worth a look. an even game drifts around
// 0.5; a dump sits near 1.
const LOPSIDED = 0.8;
// how much of a player's poker life a single opponent has to be before it reads as a
// private table rather than a coincidence
const CLINGY = 0.7;

const key = (a, b) => [String(a), String(b)].sort().join("|");

// one pass over the hands, building a per-pair picture: how often they met, how much each
// took off the other, and how much of their play was against each other
function pairsFrom(hands) {
  const pairs = new Map();
  const handsPerUser = new Map();

  for (const hand of hands) {
    const players = (hand.players || []).filter((p) => p.userId);
    for (const p of players) {
      handsPerUser.set(String(p.userId), (handsPerUser.get(String(p.userId)) || 0) + 1);
    }

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i];
        const b = players[j];
        const id = key(a.userId, b.userId);
        let pair = pairs.get(id);
        if (!pair) {
          pair = { id, users: id.split("|"), hands: 0, flow: {}, tables: new Set() };
          pairs.set(id, pair);
        }
        pair.hands += 1;
        pair.tables.add(String(hand.tableId));

        // net chips each took off the other in this hand. only meaningful when they were
        // the only two with money in it, which heads-up they always are.
        const netA = (a.wonChips || 0) - (a.totalCommitted || 0);
        const netB = (b.wonChips || 0) - (b.totalCommitted || 0);
        pair.flow[String(a.userId)] = (pair.flow[String(a.userId)] || 0) + Math.max(0, netA);
        pair.flow[String(b.userId)] = (pair.flow[String(b.userId)] || 0) + Math.max(0, netB);
      }
    }
  }
  return { pairs, handsPerUser };
}

// the share of a pair's total flow that went one way. 0.5 is an even game.
function skew(pair) {
  const [a, b] = pair.users;
  const wonA = pair.flow[a] || 0;
  const wonB = pair.flow[b] || 0;
  const total = wonA + wonB;
  if (!total) return { share: 0.5, to: null, volume: 0 };
  const share = Math.max(wonA, wonB) / total;
  return { share, to: wonA >= wonB ? a : b, volume: total };
}

// how much of each player's poker was spent against this one opponent
function clinginess(pair, handsPerUser) {
  const [a, b] = pair.users;
  const shareA = pair.hands / Math.max(1, handsPerUser.get(a) || 1);
  const shareB = pair.hands / Math.max(1, handsPerUser.get(b) || 1);
  return Math.max(shareA, shareB);
}

// build the report. `hands` is any array of PokerHand-shaped documents, so this is testable
// without a database.
function analyse(hands, { minHands = MIN_HANDS, lopsided = LOPSIDED, clingy = CLINGY } = {}) {
  const { pairs, handsPerUser } = pairsFrom(hands);
  const flagged = [];

  for (const pair of pairs.values()) {
    if (pair.hands < minHands) continue;
    const { share, to, volume } = skew(pair);
    const together = clinginess(pair, handsPerUser);
    const reasons = [];
    if (share >= lopsided) reasons.push("lopsided");
    if (together >= clingy) reasons.push("only-each-other");
    if (!reasons.length) continue;

    flagged.push({
      users: pair.users,
      hands: pair.hands,
      tables: pair.tables.size,
      // the share of chips that went one way, and who to
      skew: Number(share.toFixed(3)),
      towards: to,
      volume,
      together: Number(together.toFixed(3)),
      reasons,
    });
  }

  // worst first: a big one-sided flow between two accounts who play nobody else
  return flagged.sort(
    (a, b) => b.skew * b.volume - a.skew * a.volume || b.together - a.together
  );
}

// the scheduled pass. a window rather than all time, so a pair has to keep doing it.
async function sweep({ days = 14, limit = 5000 } = {}) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const hands = await PokerHand.find({ endedAt: { $gte: since } })
    .select("tableId players.userId players.wonChips players.totalCommitted")
    .sort({ endedAt: -1 })
    .limit(limit)
    .lean();
  return { since, hands: hands.length, flagged: analyse(hands) };
}

module.exports = { MIN_HANDS, LOPSIDED, CLINGY, pairsFrom, skew, clinginess, analyse, sweep };
