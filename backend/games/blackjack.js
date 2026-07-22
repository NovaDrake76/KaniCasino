const crypto = require("crypto");
const BlackjackHand = require("../models/BlackjackHand");
const Seed = require("../models/Seed");
const Transaction = require("../models/Transaction");
const { chargeUser, creditUser, TX } = require("../utils/economy");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const { rollFloat, TOTAL } = require("../utils/provablyFair");
const {
  BLACKJACK_ALGO_VERSION,
  MIN_BET,
  MAX_BET,
  drawCard,
  handTotal,
  dealState,
  applyInsurance,
  applyMove,
  legalMoves,
} = require("../utils/blackjackMath");

// settle credits land after the dealer-reveal animation; sweeps emit immediately
const SETTLE_EMIT_DELAY_MS = 1200;
// a hand idle this long is auto-completed by the sweep (it blocks deals and seed rotation)
const STALE_HAND_MS = 10 * 60 * 1000;
// a claimed-but-uncommitted money action older than this is recovered from the ledger
const PENDING_LEASE_MS = 60 * 1000;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function newHandId() {
  return "BJ" + String(crypto.randomInt(0, 1e9)).padStart(9, "0");
}

// rebuild the pure machine state from a persisted active hand. transient flags
// (peeked naturals, ace splits, insurance wins) only exist inside the action
// that finishes the round, so a stored active hand always restarts them clean.
function stateFromDoc(hand) {
  return {
    hands: hand.hands.map((h) => ({
      cards: h.cards.slice(),
      bet: h.bet,
      doubled: h.doubled,
      fromSplit: h.fromSplit,
      done: h.done,
    })),
    activeHandIndex: hand.activeHandIndex,
    dealerCards: hand.dealerCards.slice(),
    nextCursor: hand.nextCursor,
    betAmount: hand.betAmount,
    awaitingInsurance: hand.awaitingInsurance,
    insuranceBet: hand.insuranceBet,
    insuranceWon: 0,
    aceSplit: false,
    peekedBlackjack: false,
    finished: false,
    result: null,
  };
}

// the $set that persists a machine state, including settlement when finished
function setFromState(state) {
  const set = {
    hands: state.hands.map((h, i) => ({
      cards: h.cards,
      bet: h.bet,
      doubled: h.doubled,
      fromSplit: h.fromSplit,
      done: h.done,
      outcome: state.result ? state.result.perHand[i].outcome : null,
      payout: state.result ? state.result.perHand[i].payout : 0,
    })),
    activeHandIndex: state.activeHandIndex,
    dealerCards: state.dealerCards,
    nextCursor: state.nextCursor,
    awaitingInsurance: state.awaitingInsurance,
    insuranceBet: state.insuranceBet,
    pendingAction: null,
    pendingAt: null,
  };
  if (state.finished) {
    const now = new Date();
    Object.assign(set, {
      status: "settled",
      dealerTotal: state.result.dealerTotal,
      totalPayout: state.result.totalPayout,
      won: state.result.won,
      settledAt: now,
      settlementStartedAt: now,
      settlementDone: state.result.totalPayout === 0,
    });
  }
  return set;
}

// the only serializer: while active the dealer shows exactly one card, and the
// hole card never leaves the server in any form
function publicHandView(hand) {
  const active = hand.status === "active";
  const state = stateFromDoc(hand);
  const legal = active
    ? legalMoves(state)
    : { canHit: false, canStand: false, canDouble: false, canSplit: false, canInsure: false };
  const dealerCards = active ? [hand.dealerCards[0]] : hand.dealerCards;
  return {
    handId: hand.handId,
    status: hand.status,
    actionSeq: hand.actionSeq,
    betAmount: hand.betAmount,
    hands: hand.hands.map((h) => {
      const t = handTotal(h.cards);
      return {
        cards: h.cards,
        bet: h.bet,
        doubled: h.doubled,
        fromSplit: h.fromSplit,
        done: h.done,
        total: t.total,
        soft: t.soft,
        outcome: h.outcome || null,
        payout: h.payout || 0,
      };
    }),
    activeHandIndex: hand.activeHandIndex,
    awaitingInsurance: active && hand.awaitingInsurance,
    insuranceBet: hand.insuranceBet,
    dealer: {
      cards: dealerCards,
      total: active ? handTotal(dealerCards).total : hand.dealerTotal,
      hidden: active,
    },
    ...legal,
    totalPayout: active ? 0 : hand.totalPayout,
    fair: {
      clientSeed: hand.clientSeed,
      serverSeedHash: hand.serverSeedHash,
      nonce: hand.nonce,
    },
    rollId: hand.rollId || null,
  };
}

// a seed doc's serverSeed never changes once created (rotation makes a new doc),
// so caching it saves a round trip on every mid-hand action
const seedCache = new Map();
async function loadServerSeed(hand) {
  const key = String(hand.seedId);
  if (seedCache.has(key)) return seedCache.get(key);
  const seed = await Seed.findById(hand.seedId).select("serverSeed");
  if (!seed) throw httpError(500, "Seed material missing");
  if (seedCache.size > 500) seedCache.clear();
  seedCache.set(key, seed.serverSeed);
  return seed.serverSeed;
}

function drawFor(hand, serverSeed) {
  return (cursor) => drawCard(serverSeed, hand.clientSeed, hand.nonce, cursor);
}

// credit whatever the settled hand owes, exactly once, keyed on the ledger by
// meta.handId; then mark settlementDone. shared by the live path and the sweep.
async function paySettlement(hand, io, { emitDelayMs = 0 } = {}) {
  if (hand.totalPayout > 0) {
    const type = hand.won ? TX.BLACKJACK_WIN : TX.BLACKJACK_PUSH;
    const winnings = hand.won ? hand.totalPayout : 0;
    const natural = hand.hands.some((h) => h.outcome === "blackjack");
    const credited = await creditUser(hand.userId, hand.totalPayout, winnings, {
      type,
      meta: { handId: hand.handId, payout: hand.totalPayout, natural },
    });
    if (!credited) return false;
    const updatedUserData = {
      walletBalance: credited.walletBalance,
      xp: credited.xp,
      level: credited.level,
    };
    const emit = () => io.to(hand.userId.toString()).emit("userDataUpdated", updatedUserData);
    if (emitDelayMs > 0) {
      const timer = setTimeout(emit, emitDelayMs);
      if (timer.unref) timer.unref();
    } else {
      emit();
    }
  }
  await BlackjackHand.updateOne({ _id: hand._id }, { $set: { settlementDone: true } });
  return true;
}

// audit record: written once at settlement, best-effort (money is already settled)
async function recordHandRoll(hand, serverSeed) {
  try {
    const rec = await rolls.recordRoll({
      game: "blackjack",
      userId: hand.userId,
      seedId: hand.seedId,
      clientSeed: hand.clientSeed,
      serverSeedHash: hand.serverSeedHash,
      nonce: hand.nonce,
      cursor: 0,
      roll: Math.floor(rollFloat(serverSeed, hand.clientSeed, hand.nonce, 0) * TOTAL) + 1,
      total: TOTAL,
      outcome: {
        algoVersion: BLACKJACK_ALGO_VERSION,
        betAmount: hand.betAmount,
        insuranceBet: hand.insuranceBet,
        actions: hand.actions.map((a) => (a.auto ? { action: a.action, auto: true } : a.action)),
        playerHands: hand.hands.map((h) => ({
          cards: h.cards,
          bet: h.bet,
          doubled: h.doubled,
          fromSplit: h.fromSplit,
          outcome: h.outcome,
          payout: h.payout,
        })),
        dealerCards: hand.dealerCards,
        dealerTotal: hand.dealerTotal,
        totalPayout: hand.totalPayout,
        cardCount: hand.nextCursor,
      },
    });
    await BlackjackHand.updateOne({ _id: hand._id }, { $set: { rollId: rec.rollId } });
    return rec.rollId;
  } catch (recordError) {
    console.error("blackjack roll record failed", recordError);
    return null;
  }
}

// the payout credit and the audit roll are independent, so they share one
// round-trip window; the response reuses the settled doc instead of re-reading
async function settleAndRespond(claimed, serverSeed, io) {
  const [, rollId] = await Promise.all([
    paySettlement(claimed, io, { emitDelayMs: SETTLE_EMIT_DELAY_MS }),
    recordHandRoll(claimed, serverSeed),
  ]);
  if (rollId) claimed.rollId = rollId;
  return publicHandView(claimed);
}

// apply a no-money action (hit / stand / decline insurance) with one CAS write
async function applyAndCommit(hand, state, actionEntries, io, serverSeed) {
  const claimed = await BlackjackHand.findOneAndUpdate(
    { _id: hand._id, status: "active", actionSeq: hand.actionSeq, pendingAction: null },
    {
      $set: setFromState(state),
      $push: { actions: { $each: actionEntries } },
      $inc: { actionSeq: 1 },
    },
    { new: true }
  );
  if (!claimed) throw httpError(409, "Action already applied, refresh");
  if (claimed.status === "settled") return settleAndRespond(claimed, serverSeed, io);
  return publicHandView(claimed);
}

async function loadActiveHand(userId) {
  const hand = await BlackjackHand.findOne({ userId, status: "active" });
  if (!hand) throw httpError(404, "No active hand");
  if (hand.pendingAction) throw httpError(409, "Action already in progress");
  return hand;
}

// claim -> charge -> commit, for actions that move money mid-hand (double,
// split, insurance). the claim blocks concurrent actions while the charge is in
// flight, and the ledger row is what the sweep keys on if we crash in between.
async function moneyAction(userId, io, { name, legalKey, chargeAmount, metaKey, apply, actionName }) {
  const hand = await loadActiveHand(userId);
  const serverSeed = await loadServerSeed(hand);
  const state = stateFromDoc(hand);
  if (!legalMoves(state)[legalKey]) throw httpError(400, `Cannot ${name} now`);

  const amount = chargeAmount(state);
  const claimed = await BlackjackHand.findOneAndUpdate(
    { _id: hand._id, status: "active", actionSeq: hand.actionSeq, pendingAction: null },
    { $set: { pendingAction: name, pendingAt: new Date() }, $inc: { actionSeq: 1 } },
    { new: true }
  );
  if (!claimed) throw httpError(409, "Action already applied, refresh");

  const player = await chargeUser(userId, amount, {
    type: TX.BLACKJACK_BET,
    meta: { handId: hand.handId, betAmount: amount, [metaKey]: true },
  });
  if (!player) {
    await BlackjackHand.updateOne(
      { _id: hand._id, pendingAction: name },
      { $set: { pendingAction: null, pendingAt: null }, $inc: { actionSeq: 1 } }
    );
    throw httpError(400, "Insufficient balance");
  }
  io.to(userId.toString()).emit("userDataUpdated", {
    walletBalance: player.walletBalance,
    xp: player.xp,
    level: player.level,
  });

  apply(state, drawFor(hand, serverSeed));
  const settled = await BlackjackHand.findOneAndUpdate(
    { _id: hand._id, status: "active", pendingAction: name },
    {
      $set: setFromState(state),
      $push: { actions: { action: actionName, at: new Date() } },
      $inc: { actionSeq: 1 },
    },
    { new: true }
  );
  if (!settled) throw httpError(409, "Action already applied, refresh");
  if (settled.status === "settled") return settleAndRespond(settled, serverSeed, io);
  return publicHandView(settled);
}

class BlackjackGameController {
  static async deal(userId, betAmount, io, isRetry = false) {
    if (!Number.isInteger(betAmount) || betAmount < MIN_BET || betAmount > MAX_BET) {
      throw httpError(400, "Invalid bet amount");
    }
    // no pre-check for a live hand: the partial-unique index rejects a second
    // active hand at create time, and a burnt nonce on that path is fine

    // reserve the provably-fair nonce up front (atomic, never rolled back)
    const reserved = await seeds.reserveNonces(userId, 1);
    const nonce = reserved.startNonce;
    const state = dealState(betAmount, (cursor) =>
      drawCard(reserved.serverSeed, reserved.clientSeed, nonce, cursor)
    );

    // create before charging: an unfunded hand is visible and the sweep voids it
    // from the ledger, while a charge with no hand would be silent lost money
    let hand = null;
    for (let attempt = 0; attempt < 3 && !hand; attempt++) {
      try {
        hand = await BlackjackHand.create({
          handId: newHandId(),
          userId,
          betAmount,
          hands: state.hands.map((h) => ({ cards: h.cards, bet: h.bet, done: h.done })),
          dealerCards: state.dealerCards,
          awaitingInsurance: state.awaitingInsurance,
          seedId: reserved.seedId,
          clientSeed: reserved.clientSeed,
          serverSeedHash: reserved.serverSeedHash,
          nonce,
          nextCursor: state.nextCursor,
          actions: [{ action: "deal", at: new Date() }],
        });
      } catch (e) {
        if (e.code === 11000 && e.keyPattern && e.keyPattern.userId) {
          throw httpError(409, "Hand in progress");
        }
        if (e.code === 11000 && e.keyPattern && e.keyPattern.handId) continue;
        throw e;
      }
    }
    if (!hand) throw httpError(500, "Could not create hand");

    // the seed-liveness recheck is independent of the charge, so both run in one
    // round-trip window; a rotate racing this deal would expose the server seed
    const [player, stillActive] = await Promise.all([
      chargeUser(userId, betAmount, {
        type: TX.BLACKJACK_BET,
        meta: { handId: hand.handId, betAmount },
      }),
      Seed.exists({ _id: reserved.seedId, active: true }),
    ]);
    if (!player) {
      await BlackjackHand.updateOne(
        { _id: hand._id, status: "active" },
        { $set: { status: "voided", settlementDone: true } }
      );
      throw httpError(400, "Insufficient balance");
    }
    if (!stillActive) {
      await BlackjackHand.updateOne(
        { _id: hand._id, status: "active" },
        { $set: { status: "voided", settlementDone: true } }
      );
      await creditUser(userId, betAmount, 0, {
        type: TX.BLACKJACK_REFUND,
        meta: { handId: hand.handId, reason: "seed rotated" },
      });
      if (!isRetry) return BlackjackGameController.deal(userId, betAmount, io, true);
      throw httpError(409, "Seed rotated, try again");
    }

    io.to(userId.toString()).emit("userDataUpdated", {
      walletBalance: player.walletBalance,
      xp: player.xp,
      level: player.level,
    });

    // a peeked natural (no ace up) settles the round in the same request
    if (state.finished) {
      const claimed = await BlackjackHand.findOneAndUpdate(
        { _id: hand._id, status: "active", actionSeq: 0 },
        { $set: setFromState(state), $inc: { actionSeq: 1 } },
        { new: true }
      );
      if (claimed) return settleAndRespond(claimed, reserved.serverSeed, io);
    }

    return publicHandView(hand);
  }

  static async hit(userId, io) {
    const hand = await loadActiveHand(userId);
    const serverSeed = await loadServerSeed(hand);
    const state = stateFromDoc(hand);
    if (!legalMoves(state).canHit) throw httpError(400, "Cannot hit");
    applyMove(state, "hit", drawFor(hand, serverSeed));
    return applyAndCommit(hand, state, [{ action: "hit", at: new Date() }], io, serverSeed);
  }

  static async stand(userId, io) {
    const hand = await loadActiveHand(userId);
    const serverSeed = await loadServerSeed(hand);
    const state = stateFromDoc(hand);
    if (!legalMoves(state).canStand) throw httpError(400, "Cannot stand");
    applyMove(state, "stand", drawFor(hand, serverSeed));
    return applyAndCommit(hand, state, [{ action: "stand", at: new Date() }], io, serverSeed);
  }

  static async double(userId, io) {
    return moneyAction(userId, io, {
      name: "double",
      legalKey: "canDouble",
      chargeAmount: (state) => state.hands[state.activeHandIndex].bet,
      metaKey: "double",
      apply: (state, draw) => applyMove(state, "double", draw),
      actionName: "double",
    });
  }

  static async split(userId, io) {
    return moneyAction(userId, io, {
      name: "split",
      legalKey: "canSplit",
      chargeAmount: (state) => state.betAmount,
      metaKey: "split",
      apply: (state, draw) => applyMove(state, "split", draw),
      actionName: "split",
    });
  }

  static async insurance(userId, accept, io) {
    if (typeof accept !== "boolean") throw httpError(400, "accept must be a boolean");
    if (accept) {
      return moneyAction(userId, io, {
        name: "insurance",
        legalKey: "canInsure",
        chargeAmount: (state) => Math.floor(state.betAmount / 2),
        metaKey: "insurance",
        apply: (state, draw) => applyInsurance(state, true, draw),
        actionName: "insure",
      });
    }
    const hand = await loadActiveHand(userId);
    if (!hand.awaitingInsurance) throw httpError(400, "No insurance offered");
    const serverSeed = await loadServerSeed(hand);
    const state = stateFromDoc(hand);
    applyInsurance(state, false, drawFor(hand, serverSeed));
    return applyAndCommit(hand, state, [{ action: "noinsure", at: new Date() }], io, serverSeed);
  }

  static async active(userId) {
    const hand = await BlackjackHand.findOne({ userId, status: "active" });
    return hand ? publicHandView(hand) : null;
  }
}

// three-arm recovery sweep, same lease + ledger discipline as recoverStuckRounds:
// stale actives are auto-completed (or voided if never funded), settled-but-unpaid
// hands are paid from what the ledger says is missing, missing rolls re-recorded
async function sweepBlackjackHands(io) {
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_HAND_MS);
  const leaseCutoff = new Date(now - PENDING_LEASE_MS);
  const ioSafe = io || { to: () => ({ emit: () => {} }) };

  const stale = await BlackjackHand.find({
    status: "active",
    updatedAt: { $lte: staleCutoff },
  }).limit(50);

  for (const hand of stale) {
    try {
      const funded = await Transaction.exists({
        userId: hand.userId,
        type: TX.BLACKJACK_BET,
        "meta.handId": hand.handId,
        "meta.double": { $ne: true },
        "meta.split": { $ne: true },
        "meta.insurance": { $ne: true },
      });
      if (!funded) {
        // the crash window between create and charge: nothing charged, nothing owed
        await BlackjackHand.updateOne(
          { _id: hand._id, status: "active", actionSeq: hand.actionSeq },
          { $set: { status: "voided", settlementDone: true }, $inc: { actionSeq: 1 } }
        );
        continue;
      }

      const serverSeed = await loadServerSeed(hand);
      const draw = drawFor(hand, serverSeed);
      const state = stateFromDoc(hand);
      const entries = [];
      const pending = hand.pendingAction;

      if (pending) {
        if (hand.pendingAt && hand.pendingAt > leaseCutoff) continue;
        const charged = await Transaction.exists({
          userId: hand.userId,
          type: TX.BLACKJACK_BET,
          "meta.handId": hand.handId,
          [`meta.${pending}`]: true,
        });
        if (charged) {
          // the money landed: complete the claimed action from the frozen stream
          if (pending === "insurance") applyInsurance(state, true, draw);
          else applyMove(state, pending, draw);
          entries.push({ action: pending === "insurance" ? "insure" : pending, auto: true, at: new Date() });
        }
        // an uncharged claim is simply dropped; the stand-out below finishes the hand
      }

      if (state.awaitingInsurance && !state.finished) {
        applyInsurance(state, false, draw);
        entries.push({ action: "noinsure", auto: true, at: new Date() });
      }
      while (!state.finished) {
        applyMove(state, "stand", draw);
        entries.push({ action: "stand", auto: true, at: new Date() });
      }

      const settled = await BlackjackHand.findOneAndUpdate(
        { _id: hand._id, status: "active", actionSeq: hand.actionSeq, pendingAction: pending },
        {
          $set: setFromState(state),
          $push: { actions: { $each: entries } },
          $inc: { actionSeq: 1 },
        },
        { new: true }
      );
      if (settled) {
        await paySettlement(settled, ioSafe);
        await recordHandRoll(settled, serverSeed);
      }
    } catch (e) {
      console.error("blackjack sweep (stale) failed", hand.handId, e);
    }
  }

  const unpaid = await BlackjackHand.find({
    status: "settled",
    settlementDone: { $ne: true },
    settlementStartedAt: { $lte: leaseCutoff },
  }).limit(50);

  for (const hand of unpaid) {
    try {
      const alreadyPaid = await Transaction.exists({
        userId: hand.userId,
        type: { $in: [TX.BLACKJACK_WIN, TX.BLACKJACK_PUSH] },
        "meta.handId": hand.handId,
      });
      if (alreadyPaid) {
        await BlackjackHand.updateOne({ _id: hand._id }, { $set: { settlementDone: true } });
        continue;
      }
      await paySettlement(hand, ioSafe);
    } catch (e) {
      console.error("blackjack sweep (unpaid) failed", hand.handId, e);
    }
  }

  const unrecorded = await BlackjackHand.find({
    status: "settled",
    settlementDone: true,
    rollId: null,
  }).limit(20);
  for (const hand of unrecorded) {
    try {
      const serverSeed = await loadServerSeed(hand);
      await recordHandRoll(hand, serverSeed);
    } catch (e) {
      console.error("blackjack sweep (roll) failed", hand.handId, e);
    }
  }
}

module.exports = BlackjackGameController;
module.exports.sweepBlackjackHands = sweepBlackjackHands;
module.exports.publicHandView = publicHandView;
