const crypto = require("crypto");
const User = require("../models/User");
const Seed = require("../models/Seed");
const Transaction = require("../models/Transaction");
const Notification = require("../models/Notification");
const ScratchTicket = require("../models/ScratchTicket");
const { chargeUser, creditUser, TX } = require("../utils/economy");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const liveFeed = require("../utils/liveFeed");
const {
  SCRATCH_ALGO_VERSION,
  SLOTS,
  TICKETS,
  isTicket,
  isStateful,
  validQuantity,
  validCell,
  resolveTicket,
  treasurePayout,
} = require("../utils/scratchMath");

const TREASURE = "treasure";
const PICKS = TICKETS.treasure.picks;
// a ticket whose charge or credit is still unconfirmed this long after it started is settled from the ledger
const PENDING_LEASE_MS = 60 * 1000;
// an unfunded ticket is voided only once its charge can no longer land: four attempts of up to two minutes each
const UNFUNDED_VOID_MS = 10 * 60 * 1000;
// a treasure ticket left this long is finished for the player: it blocks their next one and their seed rotation
const STALE_TICKET_MS = 24 * 60 * 60 * 1000;
// concurrent picks on one ticket retry the compare-and-set this many times before asking for a refresh
const PICK_ATTEMPTS = 5;
// the third pick's balance push waits out the scratch of that spot, the same wait the feed row takes; tests set it to 0
const TIMING = { settlePushMs: liveFeed.REVEAL_MS.scratch };

const noIo = { to: () => ({ emit: () => {} }) };

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const newGameId = () => "SC" + String(crypto.randomInt(0, 1e9)).padStart(9, "0");
const walletOf = async (userId) => {
  const user = await User.findById(userId).select("walletBalance").lean();
  return user ? user.walletBalance : null;
};
const kp = (n) => `K₽${n.toLocaleString("en-US")}`;

// the only serializer for a treasure ticket: an active one shows the spots already picked and nothing else
function publicView(doc) {
  const settled = doc.status === "settled";
  return {
    id: doc.gameId,
    ticket: doc.ticket,
    price: doc.price,
    status: doc.status,
    picks: doc.picks.map((cell) => ({ cell, find: doc.board[cell] })),
    left: Math.max(0, PICKS - doc.picks.length),
    board: settled ? doc.board : null,
    payout: settled ? doc.payout : 0,
    auto: settled ? !!doc.auto : false,
    rollId: doc.rollId || null,
  };
}

// a ticket's whole outcome as its roll keeps it; the verifier rebuilds every field from the seed
const stackOutcome = (t) =>
  t.ticketId === "pocket"
    ? { symbol: t.symbol, multiplier: t.multiplier, payout: t.payout, cells: t.cells, line: t.line, winningCells: t.winningCells }
    : { lucky: t.lucky, multiplier: t.multiplier, payout: t.payout, spots: t.spots, winningSpots: t.winningSpots };

// a null charge is also a write that lost to another; only an empty wallet is the player's fault
async function chargeRefused(userId, cost, message) {
  const funded = await User.exists({ _id: userId, walletBalance: { $gte: cost } });
  return funded ? httpError(503, message) : httpError(400, "Insufficient balance");
}

// the third pick's push, read fresh when it goes so a bet placed meanwhile is not overwritten by an older figure
function pushBalance(io, userId, delayMs) {
  const send = async () => {
    try {
      const fresh = await User.findById(userId).select("walletBalance xp level").lean();
      if (fresh) io.to(String(userId)).emit("userDataUpdated", { walletBalance: fresh.walletBalance, xp: fresh.xp, level: fresh.level });
    } catch (e) {
      console.error("scratch balance push failed", e);
    }
  };
  if (!delayMs) return send();
  const timer = setTimeout(send, delayMs);
  if (timer.unref) timer.unref();
  return null;
}

// credit a settled ticket exactly once (the sweep checks the ledger by meta.gameId before it calls this), then close it
async function payTicket(doc, io, { immediate = false } = {}) {
  let credited = null;
  if (doc.payout > 0) {
    credited = await creditUser(doc.userId, doc.payout, doc.payout, {
      type: TX.SCRATCH_WIN,
      meta: {
        ticket: doc.ticket,
        quantity: 1,
        price: doc.price,
        betAmount: doc.price,
        payout: doc.payout,
        bestMultiplier: doc.payout / doc.price,
        gameId: doc.gameId,
      },
    });
    if (!credited) return { paid: false, balance: null };
  }
  await ScratchTicket.updateOne({ _id: doc._id }, { $set: { settlementDone: true } });
  liveFeed.publish({
    game: "scratch",
    user: credited || undefined,
    userId: doc.userId,
    bet: doc.price,
    payout: doc.payout,
    revealMs: immediate ? 0 : undefined,
  });
  if (credited) {
    if (immediate) {
      io.to(String(doc.userId)).emit("userDataUpdated", { walletBalance: credited.walletBalance, xp: credited.xp, level: credited.level });
    } else {
      await pushBalance(io, doc.userId, TIMING.settlePushMs);
    }
  }
  // nothing credited means nothing moved, but the page is still owed the final balance, so it is read once
  return { paid: true, balance: credited ? credited.walletBalance : immediate ? null : await walletOf(doc.userId) };
}

// audit record: written once the ticket settles, best-effort (the money is already settled)
async function recordTicketRoll(doc) {
  try {
    const rec = await rolls.recordRoll({
      game: "scratch",
      userId: doc.userId,
      seedId: doc.seedId,
      clientSeed: doc.clientSeed,
      serverSeedHash: doc.serverSeedHash,
      nonce: doc.nonce,
      roll: doc.slot + 1,
      total: SLOTS,
      outcome: {
        ticketId: doc.ticket,
        price: doc.price,
        board: doc.board,
        picks: doc.picks,
        payout: doc.payout,
        auto: !!doc.auto,
        gameId: doc.gameId,
        algoVersion: SCRATCH_ALGO_VERSION,
      },
    });
    await ScratchTicket.updateOne({ _id: doc._id }, { $set: { rollId: rec.rollId } });
    return rec.rollId;
  } catch (recordError) {
    console.error("scratch roll record failed", recordError);
    return null;
  }
}

class ScratchGameController {
  static async buy(userId, ticketId, quantity, io) {
    if (!isTicket(ticketId)) {
      throw httpError(400, "Invalid ticket");
    }
    if (!validQuantity(ticketId, quantity)) {
      throw httpError(400, "Invalid quantity");
    }
    return isStateful(ticketId) ? ScratchGameController.buyTreasure(userId, io) : ScratchGameController.buyStack(userId, ticketId, quantity, io);
  }

  // a stack of tickets is one charge, one credit and one roll per ticket; every ticket is settled here, before the
  // player scratches anything, so the page only reveals what is already paid
  static async buyStack(userId, ticketId, quantity, io) {
    const { price } = TICKETS[ticketId];
    const cost = price * quantity;

    // reserve every ticket's nonce up front (atomic, never rolled back)
    const reserved = await seeds.reserveNonces(userId, quantity);

    const player = await chargeUser(userId, cost, {
      type: TX.SCRATCH_BET,
      meta: { ticket: ticketId, quantity, price },
    });
    if (!player) throw await chargeRefused(userId, cost, "Those tickets could not be bought, try again");

    const tickets = Array.from({ length: quantity }, (_, i) => {
      const nonce = reserved.startNonce + i;
      return { nonce, ...resolveTicket(reserved.serverSeed, reserved.clientSeed, nonce, ticketId) };
    });
    const totalPayout = tickets.reduce((sum, t) => sum + t.payout, 0);
    const bestMultiplier = tickets.reduce((best, t) => Math.max(best, t.payout / price), 0);

    // pay out winnings atomically; a rolled-back credit is settled manually from the rolls
    let balance = player.walletBalance;
    let credited = null;
    if (totalPayout > 0) {
      credited = await creditUser(userId, totalPayout, totalPayout, {
        type: TX.SCRATCH_WIN,
        meta: { ticket: ticketId, quantity, price, betAmount: cost, payout: totalPayout, bestMultiplier },
      });
      if (credited) balance = credited.walletBalance;
    }
    const payoutFailed = totalPayout > 0 && !credited;
    liveFeed.publish({ game: "scratch", user: player, bet: cost, payout: totalPayout });

    // the balance after the charge only: the page adds each ticket's prize as it is scratched, so the navbar never spoils one
    io.to(userId.toString()).emit("userDataUpdated", {
      walletBalance: player.walletBalance,
      xp: player.xp,
      level: player.level,
    });

    // one audit roll per ticket; money is already settled, so a failed record must not turn the purchase into an error
    const recorded = await Promise.all(
      tickets.map((t) =>
        rolls
          .recordRoll({
            game: "scratch",
            userId,
            seedId: reserved.seedId,
            clientSeed: reserved.clientSeed,
            serverSeedHash: reserved.serverSeedHash,
            nonce: t.nonce,
            roll: t.slot + 1,
            total: SLOTS,
            outcome: {
              ticketId,
              price,
              ...stackOutcome(t),
              stackStart: reserved.startNonce,
              stackSize: quantity,
              algoVersion: SCRATCH_ALGO_VERSION,
            },
          })
          .catch((recordError) => {
            console.error("scratch roll record failed", recordError);
            return null;
          })
      )
    );

    if (payoutFailed) {
      throw httpError(500, "Payout failed, contact support");
    }

    return {
      ticket: ticketId,
      price,
      quantity,
      tickets: tickets.map((t, i) => ({ ...stackOutcome(t), rollId: recorded[i] ? recorded[i].rollId : null })),
      totalPayout,
      balanceAfterCharge: player.walletBalance,
      balance,
    };
  }

  // the board is laid from the seed and stored here, then only ever shown one picked spot at a time
  static async buyTreasure(userId, io, isRetry = false) {
    const { price } = TICKETS.treasure;
    const busy = "Finish your Borrowed Treasure ticket before buying another";
    if (await ScratchTicket.exists({ userId, status: "active" })) throw httpError(409, busy);

    // reserve the provably-fair nonce up front (atomic, never rolled back)
    const reserved = await seeds.reserveNonces(userId, 1);
    const nonce = reserved.startNonce;
    const { slot, board } = resolveTicket(reserved.serverSeed, reserved.clientSeed, nonce, TREASURE);

    // create before charging: an unfunded ticket is visible and the sweep voids it from the ledger, while a charge with
    // no ticket would be silent lost money
    let doc = null;
    for (let attempt = 0; attempt < 3 && !doc; attempt++) {
      try {
        doc = await ScratchTicket.create({
          gameId: newGameId(),
          userId,
          ticket: TREASURE,
          price,
          slot,
          board,
          seedId: reserved.seedId,
          clientSeed: reserved.clientSeed,
          serverSeedHash: reserved.serverSeedHash,
          nonce,
        });
      } catch (e) {
        if (e.code === 11000 && e.keyPattern && e.keyPattern.userId) throw httpError(409, busy);
        if (e.code === 11000 && e.keyPattern && e.keyPattern.gameId) continue;
        throw e;
      }
    }
    if (!doc) throw httpError(500, "Could not create the ticket");

    // this purchase's own reservation can reach the rotation and reveal the seed the board came from: void it before
    // any charge and lay a new board on the fresh seed
    if (!(await Seed.exists({ _id: reserved.seedId, active: true }))) {
      await ScratchTicket.updateOne({ _id: doc._id, status: "active" }, { $set: { status: "voided", settlementDone: true } });
      if (!isRetry) return ScratchGameController.buyTreasure(userId, io, true);
      throw httpError(409, "Seed rotated, try again");
    }

    const player = await chargeUser(userId, price, {
      type: TX.SCRATCH_BET,
      meta: { ticket: TREASURE, quantity: 1, price, gameId: doc.gameId },
    });
    if (!player) {
      await ScratchTicket.updateOne({ _id: doc._id, status: "active" }, { $set: { status: "voided", settlementDone: true } });
      throw await chargeRefused(userId, price, "That ticket could not be bought, try again");
    }
    // the sweep waits out the longest charge before it voids an unfunded ticket, so a miss here is not expected
    const opened = await ScratchTicket.findOneAndUpdate({ _id: doc._id, status: "active" }, { $set: { funded: true } }, { new: true });
    if (!opened) {
      console.error("scratch ticket voided under its own charge", doc.gameId, String(userId));
      throw httpError(500, "That ticket could not be opened, contact support");
    }

    io.to(userId.toString()).emit("userDataUpdated", {
      walletBalance: player.walletBalance,
      xp: player.xp,
      level: player.level,
    });

    return {
      ticket: TREASURE,
      price,
      quantity: 1,
      game: publicView(opened),
      balanceAfterCharge: player.walletBalance,
      balance: player.walletBalance,
    };
  }

  // one spot of the player's treasure ticket; the third one settles it. a spot already picked answers the same again
  static async pick(userId, gameId, cell, io) {
    if (typeof gameId !== "string" || !gameId) throw httpError(400, "Invalid ticket");
    if (!validCell(cell)) throw httpError(400, "Invalid spot");

    for (let attempt = 0; attempt < PICK_ATTEMPTS; attempt++) {
      const doc = await ScratchTicket.findOne({ gameId, userId });
      if (!doc || doc.status === "voided") throw httpError(404, "No such ticket");
      if (doc.picks.includes(cell)) return ScratchGameController.answer(doc, cell);
      if (doc.status !== "active" || doc.picks.length >= PICKS) throw httpError(409, "No spots left to scratch");
      if (!doc.funded) throw httpError(409, "That ticket is still being bought, try again");

      const picks = [...doc.picks, cell];
      const last = picks.length === PICKS;
      const now = new Date();
      const update = last
        ? {
            $push: { picks: cell },
            $inc: { actionSeq: 1 },
            $set: { status: "settled", payout: treasurePayout(doc.board, picks), settledAt: now, settlementStartedAt: now },
          }
        : { $push: { picks: cell }, $inc: { actionSeq: 1 } };
      const updated = await ScratchTicket.findOneAndUpdate(
        { _id: doc._id, status: "active", funded: true, actionSeq: doc.actionSeq },
        update,
        { new: true }
      );
      // another pick landed first: read the ticket again and see where this one stands
      if (!updated) continue;
      if (!last) return { ...publicView(updated), cell, find: updated.board[cell] };

      const { balance } = await payTicket(updated, io);
      updated.rollId = await recordTicketRoll(updated);
      return { ...publicView(updated), cell, find: updated.board[cell], balance };
    }
    throw httpError(409, "Too many picks at once, try again");
  }

  // the same answer for a spot picked before; a settled ticket reads the wallet once so the page still gets its balance
  static async answer(doc, cell) {
    const view = { ...publicView(doc), cell, find: doc.board[cell] };
    return doc.status === "settled" ? { ...view, balance: await walletOf(doc.userId) } : view;
  }

  static async active(userId) {
    const doc = await ScratchTicket.findOne({ userId, status: "active", funded: true });
    return doc ? publicView(doc) : null;
  }
}

// finish a ticket left a day: the lowest-numbered spots not yet picked, which is fair because the board is shuffled
async function finishIdle(doc, io) {
  const picks = [...doc.picks];
  for (let cell = 0; picks.length < PICKS; cell++) if (!picks.includes(cell)) picks.push(cell);
  const payout = treasurePayout(doc.board, picks);
  const now = new Date();
  const settled = await ScratchTicket.findOneAndUpdate(
    { _id: doc._id, status: "active", funded: true, actionSeq: doc.actionSeq },
    { $set: { picks, status: "settled", payout, auto: true, settledAt: now, settlementStartedAt: now }, $inc: { actionSeq: 1 } },
    { new: true }
  );
  if (!settled) return;
  await payTicket(settled, io, { immediate: true });
  await recordTicketRoll(settled);
  const message = `Your Borrowed Treasure ticket was left unfinished for a day, so its last spots were scratched for you. ${
    payout > 0 ? `It paid ${kp(payout)}.` : "It paid nothing."
  }`;
  await Notification.create({ receiverId: doc.userId, type: "alert", title: "Borrowed Treasure", content: message }).catch((e) =>
    console.error("scratch notification failed", doc.gameId, e.message)
  );
  io.to(String(doc.userId)).emit("newNotification", { message });
}

// recovery sweep, every five minutes from sweepRounds: four capped indexed reads of tickets, one ledger lookup per unfunded or unpaid one
async function sweepScratchTickets(io) {
  const now = Date.now();
  const leaseCutoff = new Date(now - PENDING_LEASE_MS);
  const staleCutoff = new Date(now - STALE_TICKET_MS);
  const voidCutoff = new Date(now - UNFUNDED_VOID_MS);
  const ioSafe = io || noIo;

  // a crash between create and charge, or between charge and the funded mark: the ledger says which
  const unfunded = await ScratchTicket.find({ status: "active", funded: { $ne: true }, updatedAt: { $lte: leaseCutoff } }).limit(50);
  for (const doc of unfunded) {
    try {
      const charged = await Transaction.exists({ userId: doc.userId, type: TX.SCRATCH_BET, "meta.gameId": doc.gameId });
      // no row yet may be a charge still retrying, and a void under it would take the stake for nothing
      if (!charged && doc.updatedAt > voidCutoff) continue;
      await ScratchTicket.updateOne(
        { _id: doc._id, status: "active", actionSeq: doc.actionSeq },
        charged ? { $set: { funded: true } } : { $set: { status: "voided", settlementDone: true }, $inc: { actionSeq: 1 } }
      );
    } catch (e) {
      console.error("scratch sweep (unfunded) failed", doc.gameId, e);
    }
  }

  // the third pick settled the ticket but the credit never landed: pay what the ledger is missing, never twice
  const unpaid = await ScratchTicket.find({
    status: "settled",
    settlementDone: { $ne: true },
    settlementStartedAt: { $lte: leaseCutoff },
  }).limit(50);
  for (const doc of unpaid) {
    try {
      const alreadyPaid =
        doc.payout > 0 && (await Transaction.exists({ userId: doc.userId, type: TX.SCRATCH_WIN, "meta.gameId": doc.gameId }));
      if (alreadyPaid) {
        await ScratchTicket.updateOne({ _id: doc._id }, { $set: { settlementDone: true } });
        continue;
      }
      await payTicket(doc, ioSafe, { immediate: true });
    } catch (e) {
      console.error("scratch sweep (unpaid) failed", doc.gameId, e);
    }
  }

  const unrecorded = await ScratchTicket.find({ status: "settled", settlementDone: true, rollId: null }).limit(20);
  for (const doc of unrecorded) {
    try {
      await recordTicketRoll(doc);
    } catch (e) {
      console.error("scratch sweep (roll) failed", doc.gameId, e);
    }
  }

  const stale = await ScratchTicket.find({ status: "active", funded: true, updatedAt: { $lte: staleCutoff } }).limit(50);
  for (const doc of stale) {
    try {
      await finishIdle(doc, ioSafe);
    } catch (e) {
      console.error("scratch sweep (idle) failed", doc.gameId, e);
    }
  }
}

module.exports = ScratchGameController;
module.exports.sweepScratchTickets = sweepScratchTickets;
module.exports.publicView = publicView;
module.exports.TIMING = TIMING;
module.exports.STALE_TICKET_MS = STALE_TICKET_MS;
module.exports.UNFUNDED_VOID_MS = UNFUNDED_VOID_MS;
