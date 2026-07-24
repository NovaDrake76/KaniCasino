const crypto = require("crypto");
const MinesGame = require("../models/MinesGame");
const Seed = require("../models/Seed");
const Transaction = require("../models/Transaction");
const { chargeUser, creditUser, TX } = require("../utils/economy");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const { rollFloat, TOTAL } = require("../utils/provablyFair");
const {
  MINES_ALGO_VERSION,
  TILES,
  validBet,
  validMineCount,
  deriveMines,
  multiplierFor,
  payoutCentsFor,
} = require("../utils/minesMath");

// a settled-but-unpaid cashout older than this is recovered from the ledger
const PENDING_LEASE_MS = 60 * 1000;
// a game idle this long is auto-abandoned by the sweep (it blocks deals and seed rotation)
const STALE_GAME_MS = 30 * 60 * 1000;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function newGameId() {
  return "MN" + String(crypto.randomInt(0, 1e9)).padStart(9, "0");
}

// the only serializer: the mine positions never leave the server while the game is
// active; a finished game shows them for the reveal animation
function publicView(game) {
  const active = game.status === "active";
  const gems = game.revealed.length;
  return {
    gameId: game.gameId,
    status: game.status,
    actionSeq: game.actionSeq,
    betAmount: game.betAmount,
    mineCount: game.mineCount,
    revealed: game.revealed,
    gems,
    multiplier: game.multiplier,
    // the next-gem multiplier drives the "reveal one more" hint in the ui
    nextMultiplier: active ? multiplierFor(game.mineCount, gems + 1) : null,
    canCashout: active && gems > 0,
    mineSet: active ? null : game.mineSet,
    bustTile: game.bustTile,
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
  const game = await MinesGame.findOne({ userId, status: "active" });
  if (!game) throw httpError(404, "No active game");
  return game;
}

// credit a cashed game's payout exactly once, keyed on the ledger by meta.gameId, then
// mark settlementDone. shared by the live cashout and the sweep.
async function payCashout(game, io) {
  if (game.payout > 0) {
    const credited = await creditUser(game.userId, game.payout, game.payout, {
      type: TX.MINES_WIN,
      meta: { gameId: game.gameId, betAmount: game.betAmount, mineCount: game.mineCount, gems: game.revealed.length, payout: game.payout },
    });
    if (!credited) return false;
    io.to(game.userId.toString()).emit("userDataUpdated", {
      walletBalance: credited.walletBalance,
      xp: credited.xp,
      level: credited.level,
    });
  }
  await MinesGame.updateOne({ _id: game._id }, { $set: { settlementDone: true } });
  return true;
}

// audit record: written once at settlement, best-effort (money is already settled)
async function recordGameRoll(game) {
  try {
    const seed = await Seed.findById(game.seedId).select("serverSeed");
    const serverSeed = seed ? seed.serverSeed : null;
    const rec = await rolls.recordRoll({
      game: "mines",
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
        mineCount: game.mineCount,
        mineSet: game.mineSet,
        revealed: game.revealed,
        multiplier: game.multiplier,
        payout: game.payout,
        busted: game.status === "busted",
        algoVersion: MINES_ALGO_VERSION,
      },
    });
    await MinesGame.updateOne({ _id: game._id }, { $set: { rollId: rec.rollId } });
    return rec.rollId;
  } catch (recordError) {
    console.error("mines roll record failed", recordError);
    return null;
  }
}

class MinesGameController {
  static async start(userId, betAmount, mineCount, io) {
    if (!validBet(betAmount)) throw httpError(400, "Invalid bet amount");
    if (!validMineCount(mineCount)) throw httpError(400, "Invalid mine count");

    // reserve the provably-fair nonce up front (atomic, never rolled back)
    const reserved = await seeds.reserveNonces(userId, 1);
    const nonce = reserved.startNonce;
    const mineSet = deriveMines(reserved.serverSeed, reserved.clientSeed, nonce, mineCount);

    // create before charging: an unfunded game is visible and the sweep voids it from
    // the ledger, while a charge with no game would be silent lost money
    let game = null;
    for (let attempt = 0; attempt < 3 && !game; attempt++) {
      try {
        game = await MinesGame.create({
          gameId: newGameId(),
          userId,
          betAmount,
          mineCount,
          mineSet,
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
      type: TX.MINES_BET,
      meta: { gameId: game.gameId, betAmount, mineCount },
    });
    if (!player) {
      await MinesGame.updateOne(
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

  static async reveal(userId, tile, io) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= TILES) {
      throw httpError(400, "Invalid tile");
    }
    const game = await loadActiveGame(userId);
    if (game.revealed.includes(tile) || game.mineSet.includes(tile)) {
      // a mine, or an already-open tile: only a mine ends the game
      if (game.mineSet.includes(tile) && !game.revealed.includes(tile)) {
        const busted = await MinesGame.findOneAndUpdate(
          { _id: game._id, status: "active", actionSeq: game.actionSeq },
          {
            $set: {
              status: "busted",
              bustTile: tile,
              multiplier: 0,
              payout: 0,
              settledAt: new Date(),
              settlementStartedAt: new Date(),
              settlementDone: true, // a bust owes nothing
            },
            $inc: { actionSeq: 1 },
          },
          { new: true }
        );
        if (!busted) throw httpError(409, "Action already applied, refresh");
        busted.rollId = await recordGameRoll(busted);
        return publicView(busted);
      }
      throw httpError(400, "Tile already revealed");
    }

    const gems = game.revealed.length + 1;
    const multiplier = multiplierFor(game.mineCount, gems);
    // revealing every safe tile auto-cashes at the top multiplier
    const allClear = gems === TILES - game.mineCount;
    const update = allClear
      ? {
          $set: {
            status: "cashed",
            multiplier,
            payout: payoutCentsFor(game.betAmount, game.mineCount, gems) / 100,
            settledAt: new Date(),
            settlementStartedAt: new Date(),
          },
          $push: { revealed: tile },
          $inc: { actionSeq: 1 },
        }
      : { $set: { multiplier }, $push: { revealed: tile }, $inc: { actionSeq: 1 } };

    const updated = await MinesGame.findOneAndUpdate(
      { _id: game._id, status: "active", actionSeq: game.actionSeq },
      update,
      { new: true }
    );
    if (!updated) throw httpError(409, "Action already applied, refresh");

    if (updated.status === "cashed") {
      await payCashout(updated, io);
      updated.rollId = await recordGameRoll(updated);
    }
    return publicView(updated);
  }

  static async cashout(userId, io) {
    const game = await loadActiveGame(userId);
    if (game.revealed.length === 0) throw httpError(400, "Reveal a tile before cashing out");

    const payout = payoutCentsFor(game.betAmount, game.mineCount, game.revealed.length) / 100;
    const cashed = await MinesGame.findOneAndUpdate(
      { _id: game._id, status: "active", actionSeq: game.actionSeq },
      {
        $set: {
          status: "cashed",
          payout,
          settledAt: new Date(),
          settlementStartedAt: new Date(),
        },
        $inc: { actionSeq: 1 },
      },
      { new: true }
    );
    if (!cashed) throw httpError(409, "Action already applied, refresh");

    await payCashout(cashed, io);
    cashed.rollId = await recordGameRoll(cashed);
    return publicView(cashed);
  }

  static async active(userId) {
    const game = await MinesGame.findOne({ userId, status: "active" });
    return game ? publicView(game) : null;
  }
}

// recovery sweep, same lease + ledger discipline as the blackjack sweep: cashed-but-unpaid
// games are paid from what the ledger is missing, missing rolls re-recorded, and long-idle
// active games are abandoned (a bust owes nothing, so an idle game is just left as busted)
async function sweepMinesGames(io) {
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_GAME_MS);
  const leaseCutoff = new Date(now - PENDING_LEASE_MS);
  const ioSafe = io || { to: () => ({ emit: () => {} }) };

  const unpaid = await MinesGame.find({
    status: "cashed",
    settlementDone: { $ne: true },
    settlementStartedAt: { $lte: leaseCutoff },
  }).limit(50);
  for (const game of unpaid) {
    try {
      const alreadyPaid = await Transaction.exists({
        userId: game.userId,
        type: TX.MINES_WIN,
        "meta.gameId": game.gameId,
      });
      if (alreadyPaid) {
        await MinesGame.updateOne({ _id: game._id }, { $set: { settlementDone: true } });
        continue;
      }
      await payCashout(game, ioSafe);
    } catch (e) {
      console.error("mines sweep (unpaid) failed", game.gameId, e);
    }
  }

  const unrecorded = await MinesGame.find({
    status: { $in: ["cashed", "busted"] },
    settlementDone: true,
    rollId: null,
  }).limit(20);
  for (const game of unrecorded) {
    try {
      await recordGameRoll(game);
    } catch (e) {
      console.error("mines sweep (roll) failed", game.gameId, e);
    }
  }

  // a funded game left idle is abandoned as a bust; an unfunded one (crash between create
  // and charge) is voided so nothing is owed
  const stale = await MinesGame.find({ status: "active", updatedAt: { $lte: staleCutoff } }).limit(50);
  for (const game of stale) {
    try {
      const funded = await Transaction.exists({
        userId: game.userId,
        type: TX.MINES_BET,
        "meta.gameId": game.gameId,
      });
      const next = funded
        ? { status: "busted", settledAt: new Date(), settlementStartedAt: new Date(), settlementDone: true }
        : { status: "voided", settlementDone: true };
      const swept = await MinesGame.findOneAndUpdate(
        { _id: game._id, status: "active", actionSeq: game.actionSeq },
        { $set: next, $inc: { actionSeq: 1 } },
        { new: true }
      );
      if (swept && funded) await recordGameRoll(swept);
    } catch (e) {
      console.error("mines sweep (stale) failed", game.gameId, e);
    }
  }
}

module.exports = MinesGameController;
module.exports.sweepMinesGames = sweepMinesGames;
module.exports.publicView = publicView;
