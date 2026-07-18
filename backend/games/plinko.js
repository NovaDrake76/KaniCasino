const { chargeUser, creditUser, TX } = require("../utils/economy");
const seeds = require("../utils/seeds");
const rolls = require("../utils/rolls");
const { rollFloat, TOTAL } = require("../utils/provablyFair");
const { PLINKO_ALGO_VERSION, PAYOUTS, derivePath, binFromPath } = require("../utils/plinkoMath");

// per-risk bet ceilings keep the maximum payout at 1,000,000 (cap times top multiplier)
const MAX_BET = { low: 50000, medium: 10000, high: 1000 };

// errors carry an http status so the route can answer 400s without string matching
function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

class PlinkoGameController {

    static async drop(userId, betAmount, risk, io) {

        // own-property check: inherited keys like "constructor" must not pass as risks
        if (typeof risk !== "string" || !Object.prototype.hasOwnProperty.call(PAYOUTS, risk)) {
            throw httpError(400, "Invalid risk level");
        }
        const table = PAYOUTS[risk];

        // check bet amount (whole coins only: fractional bets leak into the balance)
        if (!Number.isInteger(betAmount) || betAmount < 1 || betAmount > MAX_BET[risk]) {
            throw httpError(400, "Invalid bet amount");
        }

        // reserve the provably-fair nonce up front (atomic, never rolled back)
        const reserved = await seeds.reserveNonces(userId, 1);
        const nonce = reserved.startNonce;

        // atomically take the stake, rejecting if the balance can't cover it
        const player = await chargeUser(userId, betAmount, {
            type: TX.PLINKO_BET,
            meta: { betAmount, risk },
        });
        if (!player) {
            throw httpError(400, "Insufficient balance");
        }

        // derive the peg path from the seed (one draw per row) and price the landing bin
        const path = derivePath(reserved.serverSeed, reserved.clientSeed, nonce);
        const bin = binFromPath(path);
        const multiplierCents = table[bin];
        const payout = (betAmount * multiplierCents) / 100; // exact: integer bet times integer cents

        // pay out winnings atomically; a rolled-back credit is settled manually from the roll
        let balanceAfter = player.walletBalance;
        let credited = null;
        if (payout > 0) {
            credited = await creditUser(userId, payout, payout, {
                type: TX.PLINKO_WIN,
                meta: { betAmount, risk, bin, payout },
            });
            if (credited) balanceAfter = credited.walletBalance;
        }
        const payoutFailed = payout > 0 && !credited;

        const updatedUserData = {
            walletBalance: balanceAfter,
            xp: player.xp,
            level: player.level,
        };

        // delayed so the new balance lands about when the ball does
        const emitTimer = setTimeout(() => {
            io.to(userId.toString()).emit('userDataUpdated', updatedUserData);
        }, 3000);
        if (emitTimer.unref) emitTimer.unref(); // don't hold the event loop open (tests)

        // record the provably-fair audit roll (the path and payout reproduce from the seed);
        // money is already settled, so a failed record must not turn the drop into an error
        let rec = null;
        try {
            rec = await rolls.recordRoll({
                game: "plinko",
                userId,
                seedId: reserved.seedId,
                clientSeed: reserved.clientSeed,
                serverSeedHash: reserved.serverSeedHash,
                nonce,
                roll: Math.floor(rollFloat(reserved.serverSeed, reserved.clientSeed, nonce, 0) * TOTAL) + 1,
                total: TOTAL,
                outcome: {
                    risk,
                    betAmount,
                    path,
                    bin,
                    multiplier: multiplierCents / 100,
                    payout,
                    algoVersion: PLINKO_ALGO_VERSION,
                },
            });
        } catch (recordError) {
            console.error("plinko roll record failed", recordError);
        }

        if (payoutFailed) {
            throw httpError(500, "Payout failed, contact support");
        }

        return {
            betAmount,
            risk,
            path,
            bin,
            multiplier: multiplierCents / 100,
            payout,
            rollId: rec ? rec.rollId : null,
        };
    }
}

PlinkoGameController.MAX_BET = MAX_BET;

module.exports = PlinkoGameController;
