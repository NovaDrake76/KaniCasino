const { chargeUser, creditUser, TX } = require("../utils/economy");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const { rollFloat, TOTAL } = require("../utils/provablyFair");
const { DICE_ALGO_VERSION, normalizeTarget, validBet, resolveRoll } = require("../utils/diceMath");

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

class DiceGameController {
  static async roll(userId, betAmount, target, direction, io) {
    if (!validBet(betAmount)) {
      throw httpError(400, "Invalid bet amount");
    }
    const cleanTarget = normalizeTarget(target, direction);
    if (cleanTarget === null) {
      throw httpError(400, "Invalid target");
    }

    // reserve the provably-fair nonce up front (atomic, never rolled back)
    const reserved = await seeds.reserveNonces(userId, 1);
    const nonce = reserved.startNonce;

    // atomically take the stake, rejecting if the balance can't cover it
    const player = await chargeUser(userId, betAmount, {
      type: TX.DICE_BET,
      meta: { betAmount, target: cleanTarget, direction },
    });
    if (!player) {
      throw httpError(400, "Insufficient balance");
    }

    const float = rollFloat(reserved.serverSeed, reserved.clientSeed, nonce, 0);
    const outcome = resolveRoll(float, betAmount, cleanTarget, direction);

    // pay out winnings atomically; a rolled-back credit is settled manually from the roll
    let balanceAfter = player.walletBalance;
    let credited = null;
    if (outcome.payout > 0) {
      credited = await creditUser(userId, outcome.payout, outcome.payout, {
        type: TX.DICE_WIN,
        meta: { betAmount, target: cleanTarget, direction, multiplier: outcome.multiplier, payout: outcome.payout },
      });
      if (credited) balanceAfter = credited.walletBalance;
    }
    const payoutFailed = outcome.payout > 0 && !credited;

    io.to(userId.toString()).emit("userDataUpdated", {
      walletBalance: balanceAfter,
      xp: player.xp,
      level: player.level,
    });

    // record the provably-fair audit roll (the result and payout reproduce from the seed);
    // money is already settled, so a failed record must not turn the roll into an error
    let rec = null;
    try {
      rec = await rolls.recordRoll({
        game: "dice",
        userId,
        seedId: reserved.seedId,
        clientSeed: reserved.clientSeed,
        serverSeedHash: reserved.serverSeedHash,
        nonce,
        roll: Math.floor(float * TOTAL) + 1,
        total: TOTAL,
        outcome: {
          betAmount,
          target: cleanTarget,
          direction,
          result: outcome.result,
          multiplier: outcome.multiplier,
          winChance: outcome.winChance,
          won: outcome.won,
          payout: outcome.payout,
          algoVersion: DICE_ALGO_VERSION,
        },
      });
    } catch (recordError) {
      console.error("dice roll record failed", recordError);
    }

    if (payoutFailed) {
      throw httpError(500, "Payout failed, contact support");
    }

    return {
      betAmount,
      target: cleanTarget,
      direction,
      result: outcome.result,
      resultValue: outcome.resultValue,
      multiplier: outcome.multiplier,
      winChance: outcome.winChance,
      won: outcome.won,
      payout: outcome.payout,
      balance: balanceAfter,
      rollId: rec ? rec.rollId : null,
    };
  }
}

module.exports = DiceGameController;
