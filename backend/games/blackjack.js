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
  isBlackjack,
  dealerPlay,
  settle,
} = require("../utils/blackjackMath");

// settle credits land after the dealer-reveal animation; sweeps emit immediately
const SETTLE_EMIT_DELAY_MS = 1200;
// a hand idle this long is auto-stood by the sweep (it blocks deals and seed rotation)
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

// the only serializer: while active the dealer shows exactly one card, and the
// hole card never leaves the server in any form
function publicHandView(hand) {
  const active = hand.status === "active";
  const dealerCards = active ? [hand.dealerCards[0]] : hand.dealerCards;
  const first = hand.hands[0];
  const firstTotal = handTotal(first.cards);
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
        total: t.total,
        soft: t.soft,
        outcome: h.outcome || null,
        payout: h.payout || 0,
      };
    }),
    activeHandIndex: hand.activeHandIndex,
    dealer: {
      cards: dealerCards,
      total: active ? handTotal(dealerCards).total : hand.dealerTotal,
      hidden: active,
    },
    canHit: active && firstTotal.total < 21,
    canStand: active,
    canDouble: active && first.cards.length === 2 && !first.doubled,
    totalPayout: active ? 0 : hand.totalPayout,
    fair: {
      clientSeed: hand.clientSeed,
      serverSeedHash: hand.serverSeedHash,
      nonce: hand.nonce,
    },
    rollId: hand.rollId || null,
  };
}

async function loadServerSeed(hand) {
  const seed = await Seed.findById(hand.seedId).select("serverSeed");
  if (!seed) throw httpError(500, "Seed material missing");
  return seed.serverSeed;
}

// credit whatever the settled hand owes, exactly once, keyed on the ledger by
// meta.handId; then mark settlementDone. shared by the live path and the sweep.
async function paySettlement(hand, io, { emitDelayMs = 0 } = {}) {
  if (hand.totalPayout > 0) {
    const isPush = hand.hands.every((h) => h.outcome === "push" || h.outcome === "lose");
    const type = isPush ? TX.BLACKJACK_PUSH : TX.BLACKJACK_WIN;
    const winnings = isPush ? 0 : hand.totalPayout;
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
        actions: hand.actions.map((a) => (a.auto ? { action: a.action, auto: true } : a.action)),
        playerHands: hand.hands.map((h) => ({
          cards: h.cards,
          bet: h.bet,
          doubled: h.doubled,
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

// dealer draws from the frozen stream, the result is priced, and the whole
// settlement folds into one compare-and-set write built by the caller
function computeDealerSettle(serverSeed, hand, playerCards, bet, doubled, startCursor) {
  let cursor = startCursor;
  const playerBusted = handTotal(playerCards).total > 21;
  const dealerCards = playerBusted
    ? hand.dealerCards.slice()
    : dealerPlay(hand.dealerCards, () =>
        drawCard(serverSeed, hand.clientSeed, hand.nonce, cursor++)
      );
  const result = settle([{ cards: playerCards, bet, doubled }], dealerCards);
  return { dealerCards, result, nextCursor: cursor };
}

function settlementSet(playerCards, bet, doubled, dealerCards, result, nextCursor) {
  const now = new Date();
  return {
    "hands.0.cards": playerCards,
    "hands.0.bet": bet,
    "hands.0.doubled": doubled,
    "hands.0.outcome": result.perHand[0].outcome,
    "hands.0.payout": result.perHand[0].payout,
    dealerCards,
    dealerTotal: result.dealerTotal,
    totalPayout: result.totalPayout,
    nextCursor,
    status: "settled",
    settledAt: now,
    settlementStartedAt: now,
    settlementDone: result.totalPayout === 0,
    pendingAction: null,
    pendingAt: null,
  };
}

class BlackjackGameController {
  static async deal(userId, betAmount, io, isRetry = false) {
    if (!Number.isInteger(betAmount) || betAmount < MIN_BET || betAmount > MAX_BET) {
      throw httpError(400, "Invalid bet amount");
    }
    if (await BlackjackHand.exists({ userId, status: "active" })) {
      throw httpError(409, "Hand in progress");
    }

    // reserve the provably-fair nonce up front (atomic, never rolled back)
    const reserved = await seeds.reserveNonces(userId, 1);
    const nonce = reserved.startNonce;
    const playerCards = [
      drawCard(reserved.serverSeed, reserved.clientSeed, nonce, 0),
      drawCard(reserved.serverSeed, reserved.clientSeed, nonce, 2),
    ];
    const dealerCards = [
      drawCard(reserved.serverSeed, reserved.clientSeed, nonce, 1),
      drawCard(reserved.serverSeed, reserved.clientSeed, nonce, 3),
    ];

    // create before charging: an unfunded hand is visible and the sweep voids it
    // from the ledger, while a charge with no hand would be silent lost money
    let hand = null;
    for (let attempt = 0; attempt < 3 && !hand; attempt++) {
      try {
        hand = await BlackjackHand.create({
          handId: newHandId(),
          userId,
          betAmount,
          hands: [{ cards: playerCards, bet: betAmount }],
          dealerCards,
          seedId: reserved.seedId,
          clientSeed: reserved.clientSeed,
          serverSeedHash: reserved.serverSeedHash,
          nonce,
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

    const player = await chargeUser(userId, betAmount, {
      type: TX.BLACKJACK_BET,
      meta: { handId: hand.handId, betAmount },
    });
    if (!player) {
      await BlackjackHand.updateOne(
        { _id: hand._id, status: "active" },
        { $set: { status: "voided", settlementDone: true } }
      );
      throw httpError(400, "Insufficient balance");
    }

    // the seed must still be unrevealed: a rotate racing this deal would let the
    // player finish the hand against a public server seed
    const stillActive = await Seed.exists({ _id: reserved.seedId, active: true });
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

    // american peek: any two-card 21 settles the hand right now, so a player can
    // never put more money into a hand the dealer has already won
    if (isBlackjack(playerCards) || isBlackjack(dealerCards)) {
      const result = settle(
        [{ cards: playerCards, bet: betAmount, doubled: false }],
        dealerCards
      );
      const claimed = await BlackjackHand.findOneAndUpdate(
        { _id: hand._id, status: "active", actionSeq: 0 },
        {
          $set: settlementSet(playerCards, betAmount, false, dealerCards, result, 4),
          $inc: { actionSeq: 1 },
        },
        { new: true }
      );
      if (claimed) {
        await paySettlement(claimed, io, { emitDelayMs: SETTLE_EMIT_DELAY_MS });
        await recordHandRoll(claimed, reserved.serverSeed);
        return publicHandView(await BlackjackHand.findById(claimed._id));
      }
    }

    return publicHandView(hand);
  }

  static async hit(userId, io) {
    const hand = await BlackjackHand.findOne({ userId, status: "active" });
    if (!hand) throw httpError(404, "No active hand");
    if (hand.pendingAction) throw httpError(409, "Action already in progress");
    if (handTotal(hand.hands[0].cards).total >= 21) throw httpError(400, "Cannot hit");

    const serverSeed = await loadServerSeed(hand);
    const card = drawCard(serverSeed, hand.clientSeed, hand.nonce, hand.nextCursor);
    const newCards = [...hand.hands[0].cards, card];
    const { total } = handTotal(newCards);
    const bet = hand.hands[0].bet;
    const action = { action: "hit", at: new Date() };

    if (total >= 21) {
      // bust settles with the hole face-down math; 21 auto-stands into dealer play
      const { dealerCards, result, nextCursor } = computeDealerSettle(
        serverSeed, hand, newCards, bet, false, hand.nextCursor + 1
      );
      const claimed = await BlackjackHand.findOneAndUpdate(
        { _id: hand._id, status: "active", actionSeq: hand.actionSeq, pendingAction: null },
        {
          $set: settlementSet(newCards, bet, false, dealerCards, result, nextCursor),
          $push: { actions: action },
          $inc: { actionSeq: 1 },
        },
        { new: true }
      );
      if (!claimed) throw httpError(409, "Action already applied, refresh");
      await paySettlement(claimed, io, { emitDelayMs: SETTLE_EMIT_DELAY_MS });
      await recordHandRoll(claimed, serverSeed);
      return publicHandView(await BlackjackHand.findById(claimed._id));
    }

    const claimed = await BlackjackHand.findOneAndUpdate(
      { _id: hand._id, status: "active", actionSeq: hand.actionSeq, pendingAction: null },
      {
        $set: { "hands.0.cards": newCards, nextCursor: hand.nextCursor + 1 },
        $push: { actions: action },
        $inc: { actionSeq: 1 },
      },
      { new: true }
    );
    if (!claimed) throw httpError(409, "Action already applied, refresh");
    return publicHandView(claimed);
  }

  static async stand(userId, io) {
    const hand = await BlackjackHand.findOne({ userId, status: "active" });
    if (!hand) throw httpError(404, "No active hand");
    if (hand.pendingAction) throw httpError(409, "Action already in progress");

    const serverSeed = await loadServerSeed(hand);
    const first = hand.hands[0];
    const { dealerCards, result, nextCursor } = computeDealerSettle(
      serverSeed, hand, first.cards, first.bet, first.doubled, hand.nextCursor
    );
    const claimed = await BlackjackHand.findOneAndUpdate(
      { _id: hand._id, status: "active", actionSeq: hand.actionSeq, pendingAction: null },
      {
        $set: settlementSet(first.cards, first.bet, first.doubled, dealerCards, result, nextCursor),
        $push: { actions: { action: "stand", at: new Date() } },
        $inc: { actionSeq: 1 },
      },
      { new: true }
    );
    if (!claimed) throw httpError(409, "Action already applied, refresh");
    await paySettlement(claimed, io, { emitDelayMs: SETTLE_EMIT_DELAY_MS });
    await recordHandRoll(claimed, serverSeed);
    return publicHandView(await BlackjackHand.findById(claimed._id));
  }

  static async double(userId, io) {
    const hand = await BlackjackHand.findOne({ userId, status: "active" });
    if (!hand) throw httpError(404, "No active hand");
    if (hand.pendingAction) throw httpError(409, "Action already in progress");
    if (hand.hands[0].cards.length !== 2 || hand.hands[0].doubled) {
      throw httpError(400, "Cannot double now");
    }

    // claim first, charge second: the claim blocks concurrent actions while the
    // money moves, and the ledger row is what recovery keys on if we crash here
    const claimed = await BlackjackHand.findOneAndUpdate(
      {
        _id: hand._id,
        status: "active",
        actionSeq: hand.actionSeq,
        pendingAction: null,
        "hands.0.cards": { $size: 2 },
        "hands.0.doubled": false,
      },
      { $set: { pendingAction: "double", pendingAt: new Date() }, $inc: { actionSeq: 1 } },
      { new: true }
    );
    if (!claimed) throw httpError(409, "Action already applied, refresh");

    const player = await chargeUser(userId, hand.betAmount, {
      type: TX.BLACKJACK_BET,
      meta: { handId: hand.handId, betAmount: hand.betAmount, double: true },
    });
    if (!player) {
      await BlackjackHand.updateOne(
        { _id: hand._id, pendingAction: "double" },
        { $set: { pendingAction: null, pendingAt: null }, $inc: { actionSeq: 1 } }
      );
      throw httpError(400, "Insufficient balance");
    }
    io.to(userId.toString()).emit("userDataUpdated", {
      walletBalance: player.walletBalance,
      xp: player.xp,
      level: player.level,
    });

    const serverSeed = await loadServerSeed(hand);
    const newCards = [
      ...hand.hands[0].cards,
      drawCard(serverSeed, hand.clientSeed, hand.nonce, hand.nextCursor),
    ];
    const doubledBet = hand.betAmount * 2;
    const { dealerCards, result, nextCursor } = computeDealerSettle(
      serverSeed, hand, newCards, doubledBet, true, hand.nextCursor + 1
    );
    const settled = await BlackjackHand.findOneAndUpdate(
      { _id: hand._id, status: "active", pendingAction: "double" },
      {
        $set: settlementSet(newCards, doubledBet, true, dealerCards, result, nextCursor),
        $push: { actions: { action: "double", at: new Date() } },
        $inc: { actionSeq: 1 },
      },
      { new: true }
    );
    if (!settled) throw httpError(409, "Action already applied, refresh");
    await paySettlement(settled, io, { emitDelayMs: SETTLE_EMIT_DELAY_MS });
    await recordHandRoll(settled, serverSeed);
    return publicHandView(await BlackjackHand.findById(settled._id));
  }

  static async active(userId) {
    const hand = await BlackjackHand.findOne({ userId, status: "active" });
    return hand ? publicHandView(hand) : null;
  }
}

// three-arm recovery sweep, same lease + ledger discipline as recoverStuckRounds:
// stale actives are auto-stood (or voided if never funded), settled-but-unpaid
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
      if (hand.pendingAction === "double") {
        if (hand.pendingAt && hand.pendingAt > leaseCutoff) continue;
        const doubleCharged = await Transaction.exists({
          userId: hand.userId,
          type: TX.BLACKJACK_BET,
          "meta.handId": hand.handId,
          "meta.double": true,
        });
        if (!doubleCharged) {
          await BlackjackHand.updateOne(
            { _id: hand._id, pendingAction: "double" },
            { $set: { pendingAction: null, pendingAt: null }, $inc: { actionSeq: 1 } }
          );
          continue;
        }
        // the double was paid for: complete it from the deterministic stream
        const serverSeed = await loadServerSeed(hand);
        const newCards = [
          ...hand.hands[0].cards,
          drawCard(serverSeed, hand.clientSeed, hand.nonce, hand.nextCursor),
        ];
        const doubledBet = hand.betAmount * 2;
        const { dealerCards, result, nextCursor } = computeDealerSettle(
          serverSeed, hand, newCards, doubledBet, true, hand.nextCursor + 1
        );
        const settled = await BlackjackHand.findOneAndUpdate(
          { _id: hand._id, status: "active", pendingAction: "double" },
          {
            $set: settlementSet(newCards, doubledBet, true, dealerCards, result, nextCursor),
            $push: { actions: { action: "double", auto: true, at: new Date() } },
            $inc: { actionSeq: 1 },
          },
          { new: true }
        );
        if (settled) {
          await paySettlement(settled, ioSafe);
          await recordHandRoll(settled, serverSeed);
        }
        continue;
      }

      const funded = await Transaction.exists({
        userId: hand.userId,
        type: TX.BLACKJACK_BET,
        "meta.handId": hand.handId,
        "meta.double": { $ne: true },
      });
      if (!funded) {
        await BlackjackHand.updateOne(
          { _id: hand._id, status: "active", actionSeq: hand.actionSeq },
          { $set: { status: "voided", settlementDone: true }, $inc: { actionSeq: 1 } }
        );
        continue;
      }

      const serverSeed = await loadServerSeed(hand);
      const first = hand.hands[0];
      const { dealerCards, result, nextCursor } = computeDealerSettle(
        serverSeed, hand, first.cards, first.bet, first.doubled, hand.nextCursor
      );
      const settled = await BlackjackHand.findOneAndUpdate(
        { _id: hand._id, status: "active", actionSeq: hand.actionSeq, pendingAction: null },
        {
          $set: settlementSet(first.cards, first.bet, first.doubled, dealerCards, result, nextCursor),
          $push: { actions: { action: "stand", auto: true, at: new Date() } },
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
