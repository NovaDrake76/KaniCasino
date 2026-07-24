const crypto = require("crypto");
const HiloGame = require("../models/HiloGame");
const Seed = require("../models/Seed");
const Transaction = require("../models/Transaction");
const { chargeUser, creditUser, TX } = require("../utils/economy");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const { rollFloat, TOTAL } = require("../utils/provablyFair");
const {
  HILO_ALGO_VERSION,
  MAX_SKIPS,
  cardAt,
  rankOf,
  hiChance,
  loChance,
  stepMultiplier,
  guessWins,
  validBet,
  payoutCentsFor,
} = require("../utils/hiloMath");

const PENDING_LEASE_MS = 60 * 1000;
const STALE_GAME_MS = 30 * 60 * 1000;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function newGameId() {
  return "HL" + String(crypto.randomInt(0, 1e9)).padStart(9, "0");
}

// the current card, its odds and both potential multipliers, so the ui can price each
// side against the running total before the player commits
function currentView(game) {
  const current = game.cards[game.cards.length - 1];
  const rank = rankOf(current);
  return {
    current,
    hiChance: hiChance(rank),
    loChance: loChance(rank),
    hiMultiplier: game.multiplier * stepMultiplier(rank, "hi"),
    loMultiplier: game.multiplier * stepMultiplier(rank, "lo"),
  };
}

function publicView(game) {
  const active = game.status === "active";
  return {
    gameId: game.gameId,
    status: game.status,
    actionSeq: game.actionSeq,
    betAmount: game.betAmount,
    cards: game.cards,
    multiplier: game.multiplier,
    guesses: game.guesses,
    skips: game.skips,
    ...(active ? currentView(game) : { current: game.cards[game.cards.length - 1] }),
    canCashout: active && game.guesses > 0,
    canSkip: active && game.skips < MAX_SKIPS,
    payout: active ? 0 : game.payout,
    fair: {
      clientSeed: game.clientSeed,
      serverSeedHash: game.serverSeedHash,
      nonce: game.nonce,
    },
    rollId: game.rollId || null,
  };
}

async function loadActiveGame(userId) {
  const game = await HiloGame.findOne({ userId, status: "active" });
  if (!game) throw httpError(404, "No active game");
  return game;
}

async function loadServerSeed(game) {
  const seed = await Seed.findById(game.seedId).select("serverSeed");
  if (!seed) throw httpError(500, "Seed material missing");
  return seed.serverSeed;
}

const drawAt = (serverSeed, game, cursor) => cardAt(serverSeed, game.clientSeed, game.nonce, cursor);

// credit a cashed game's payout exactly once, keyed on the ledger by meta.gameId
async function payCashout(game, io) {
  if (game.payout > 0) {
    const credited = await creditUser(game.userId, game.payout, game.payout, {
      type: TX.HILO_WIN,
      meta: { gameId: game.gameId, betAmount: game.betAmount, guesses: game.guesses, multiplier: game.multiplier, payout: game.payout },
    });
    if (!credited) return false;
    io.to(game.userId.toString()).emit("userDataUpdated", {
      walletBalance: credited.walletBalance,
      xp: credited.xp,
      level: credited.level,
    });
  }
  await HiloGame.updateOne({ _id: game._id }, { $set: { settlementDone: true } });
  return true;
}

// audit record: written once at settlement, best-effort (money is already settled)
async function recordGameRoll(game) {
  try {
    const serverSeed = await loadServerSeed(game).catch(() => null);
    const rec = await rolls.recordRoll({
      game: "hilo",
      userId: game.userId,
      seedId: game.seedId,
      clientSeed: game.clientSeed,
      serverSeedHash: game.serverSeedHash,
      nonce: game.nonce,
      cursor: 0,
      roll: serverSeed ? Math.floor(rollFloat(serverSeed, game.clientSeed, game.nonce, 0) * TOTAL) + 1 : 0,
      total: TOTAL,
      outcome: {
        betAmount: game.betAmount,
        actions: game.actions,
        cards: game.cards,
        multiplier: game.multiplier,
        guesses: game.guesses,
        busted: game.status === "busted",
        payout: game.payout,
        algoVersion: HILO_ALGO_VERSION,
      },
    });
    await HiloGame.updateOne({ _id: game._id }, { $set: { rollId: rec.rollId } });
    return rec.rollId;
  } catch (recordError) {
    console.error("hilo roll record failed", recordError);
    return null;
  }
}

class HiloGameController {
  static async start(userId, betAmount, io) {
    if (!validBet(betAmount)) throw httpError(400, "Invalid bet amount");

    const reserved = await seeds.reserveNonces(userId, 1);
    const nonce = reserved.startNonce;
    const startCard = cardAt(reserved.serverSeed, reserved.clientSeed, nonce, 0);

    // create before charging: an unfunded game is visible and the sweep voids it
    let game = null;
    for (let attempt = 0; attempt < 3 && !game; attempt++) {
      try {
        game = await HiloGame.create({
          gameId: newGameId(),
          userId,
          betAmount,
          cards: [startCard],
          seedId: reserved.seedId,
          clientSeed: reserved.clientSeed,
          serverSeedHash: reserved.serverSeedHash,
          nonce,
        });
      } catch (e) {
        if (e.code === 11000 && e.keyPattern && e.keyPattern.userId) {
          throw httpError(409, "Game in progress");
        }
        if (e.code === 11000 && e.keyPattern && e.keyPattern.gameId) continue;
        throw e;
      }
    }
    if (!game) throw httpError(500, "Could not create game");

    const player = await chargeUser(userId, betAmount, {
      type: TX.HILO_BET,
      meta: { gameId: game.gameId, betAmount },
    });
    if (!player) {
      await HiloGame.updateOne(
        { _id: game._id, status: "active" },
        { $set: { status: "voided", settlementDone: true } }
      );
      throw httpError(400, "Insufficient balance");
    }

    io.to(userId.toString()).emit("userDataUpdated", {
      walletBalance: player.walletBalance,
      xp: player.xp,
      level: player.level,
    });

    return publicView(game);
  }

  static async guess(userId, direction, io) {
    if (direction !== "hi" && direction !== "lo") throw httpError(400, "Invalid direction");
    const game = await loadActiveGame(userId);
    const serverSeed = await loadServerSeed(game);

    const current = game.cards[game.cards.length - 1];
    const next = drawAt(serverSeed, game, game.cards.length);
    const won = guessWins(rankOf(current), rankOf(next), direction);
    const action = direction === "hi" ? "guess-hi" : "guess-lo";

    if (won) {
      const nextMultiplier = game.multiplier * stepMultiplier(rankOf(current), direction);
      const updated = await HiloGame.findOneAndUpdate(
        { _id: game._id, status: "active", actionSeq: game.actionSeq },
        { $push: { cards: next, actions: action }, $set: { multiplier: nextMultiplier }, $inc: { guesses: 1, actionSeq: 1 } },
        { new: true }
      );
      if (!updated) throw httpError(409, "Action already applied, refresh");
      return publicView(updated);
    }

    const busted = await HiloGame.findOneAndUpdate(
      { _id: game._id, status: "active", actionSeq: game.actionSeq },
      {
        $push: { cards: next, actions: action },
        $set: { status: "busted", payout: 0, settledAt: new Date(), settlementStartedAt: new Date(), settlementDone: true },
        $inc: { actionSeq: 1 },
      },
      { new: true }
    );
    if (!busted) throw httpError(409, "Action already applied, refresh");
    busted.rollId = await recordGameRoll(busted);
    return publicView(busted);
  }

  static async skip(userId, io) {
    const game = await loadActiveGame(userId);
    if (game.skips >= MAX_SKIPS) throw httpError(400, "No skips left");
    const serverSeed = await loadServerSeed(game);
    const next = drawAt(serverSeed, game, game.cards.length);

    const updated = await HiloGame.findOneAndUpdate(
      { _id: game._id, status: "active", actionSeq: game.actionSeq },
      { $push: { cards: next, actions: "skip" }, $inc: { skips: 1, actionSeq: 1 } },
      { new: true }
    );
    if (!updated) throw httpError(409, "Action already applied, refresh");
    return publicView(updated);
  }

  static async cashout(userId, io) {
    const game = await loadActiveGame(userId);
    if (game.guesses === 0) throw httpError(400, "Make a prediction before cashing out");

    const payout = payoutCentsFor(game.betAmount, game.multiplier) / 100;
    const cashed = await HiloGame.findOneAndUpdate(
      { _id: game._id, status: "active", actionSeq: game.actionSeq },
      { $set: { status: "cashed", payout, settledAt: new Date(), settlementStartedAt: new Date() }, $inc: { actionSeq: 1 } },
      { new: true }
    );
    if (!cashed) throw httpError(409, "Action already applied, refresh");
    await payCashout(cashed, io);
    cashed.rollId = await recordGameRoll(cashed);
    return publicView(cashed);
  }

  static async active(userId) {
    const game = await HiloGame.findOne({ userId, status: "active" });
    return game ? publicView(game) : null;
  }
}

// recovery sweep, same lease + ledger discipline as the blackjack/mines sweeps
async function sweepHiloGames(io) {
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_GAME_MS);
  const leaseCutoff = new Date(now - PENDING_LEASE_MS);
  const ioSafe = io || { to: () => ({ emit: () => {} }) };

  const unpaid = await HiloGame.find({
    status: "cashed",
    settlementDone: { $ne: true },
    settlementStartedAt: { $lte: leaseCutoff },
  }).limit(50);
  for (const game of unpaid) {
    try {
      const alreadyPaid = await Transaction.exists({ userId: game.userId, type: TX.HILO_WIN, "meta.gameId": game.gameId });
      if (alreadyPaid) {
        await HiloGame.updateOne({ _id: game._id }, { $set: { settlementDone: true } });
        continue;
      }
      await payCashout(game, ioSafe);
    } catch (e) {
      console.error("hilo sweep (unpaid) failed", game.gameId, e);
    }
  }

  const unrecorded = await HiloGame.find({
    status: { $in: ["cashed", "busted"] },
    settlementDone: true,
    rollId: null,
  }).limit(20);
  for (const game of unrecorded) {
    try {
      await recordGameRoll(game);
    } catch (e) {
      console.error("hilo sweep (roll) failed", game.gameId, e);
    }
  }

  // a funded game left idle is abandoned as a bust; an unfunded one is voided
  const stale = await HiloGame.find({ status: "active", updatedAt: { $lte: staleCutoff } }).limit(50);
  for (const game of stale) {
    try {
      const funded = await Transaction.exists({ userId: game.userId, type: TX.HILO_BET, "meta.gameId": game.gameId });
      const next = funded
        ? { status: "busted", payout: 0, settledAt: new Date(), settlementStartedAt: new Date(), settlementDone: true }
        : { status: "voided", settlementDone: true };
      const swept = await HiloGame.findOneAndUpdate(
        { _id: game._id, status: "active", actionSeq: game.actionSeq },
        { $set: next, $inc: { actionSeq: 1 } },
        { new: true }
      );
      if (swept && funded) await recordGameRoll(swept);
    } catch (e) {
      console.error("hilo sweep (stale) failed", game.gameId, e);
    }
  }
}

module.exports = HiloGameController;
module.exports.sweepHiloGames = sweepHiloGames;
module.exports.publicView = publicView;
