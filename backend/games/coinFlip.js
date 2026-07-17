const Round = require("../models/Round");
const { chargeUser, creditUser, TX } = require("../utils/economy");
const { coinResultFromSeed } = require("../utils/coinMath");
const { consumeNextSeed } = require("../utils/gameChain");
const { sha256 } = require("../utils/hashChain");

// a fair coin paying 2x is a 0% house edge: the house cannot win, and the game is a
// pure variance pump on the KP supply that no amount of play ever drains. paying
// 1.94x puts it at 3%, in the same band as crash (3.97%) and slots (3.55%).
// floor keeps the payout in whole KP and always rounds towards the house, so there is
// no bet size that rounds its way into a player edge.
const COINFLIP_RTP = 0.97;
const winPayout = (bet) => Math.floor(bet * 2 * COINFLIP_RTP);

// a table minimum, for the reason real tables have one: the payout is whole KP, and no
// integer pays 3% on a 1 KP stake (1 is 50%, 2 is 0%), so below a floor the rounding is
// the edge. at 10 the worst case is 5% and by 50 it is exactly 3%.
const MIN_BET = 10;
const MAX_BET = 1000000;

const freshState = () => ({
  heads: { players: {}, bets: {} },
  tails: { players: {}, bets: {} },
  serverSeed: null, // the round's seed, secret until the flip is revealed
  serverSeedHash: null, // its commitment, public from betting open
  result: null, // decided by the seed at betting open, revealed with the flip
});

// the result stays off the wire until the flip. serverSeedHash is safe: it is a one-way
// commitment, and the result cannot be derived from it without the seed.
const publicCoinState = (state) => ({
  heads: state.heads,
  tails: state.tails,
  serverSeedHash: state.serverSeedHash,
});

// the timings are arguments so a test can run a whole round in milliseconds against a
// real database. faking the clock instead breaks the mongo driver's own timers.
const coinFlip = (io, { bettingMs = 14000, revealMs = 5000, retryMs = 2000 } = {}) => {
  let gameState = freshState();
  // the persisted record of the round being played. bets refuse to open without one:
  // taking a stake we cannot account for later is the thing this exists to stop.
  let round = null;
  // bets are only accepted in the window between flips
  let bettingOpen = false;
  // players whose charge is still in flight, so a duplicate emit can't get through
  const pendingBets = new Set();
  // the round loop runs forever, so it needs a way out: without one a restart or a test
  // leaves it looping against a database that is no longer there
  let stopped = false;
  let nextRound = null;
  let reveal = null;

  io.on("connection", (socket) => {
    socket.on("coinFlip:bet", async (bet, choice, callback) => {
      // the client used to get no answer at all when a bet was refused
      const reply = (result) => {
        if (typeof callback === "function") callback(result);
      };

      try {
        const userId = socket.userId;
        if (!userId) return reply({ error: "You must be logged in to bet" });
        if (!bettingOpen || !round) return reply({ error: "Betting is closed for this round" });

        if (choice !== 0 && choice !== 1) return reply({ error: "Pick heads or tails" });
        if (!Number.isInteger(bet) || bet < MIN_BET || bet > MAX_BET) {
          return reply({ error: `Bet between ${MIN_BET} and ${MAX_BET} KP` });
        }

        const side = choice === 0 ? "heads" : "tails";
        const other = choice === 0 ? "tails" : "heads";

        // one bet per round, on a single side. pendingBets covers the window while
        // the charge is in flight: without it, two emits in the same tick both pass
        // this guard and the player ends up backing heads and tails at once
        if (
          gameState[side].bets[userId] ||
          gameState[other].bets[userId] ||
          pendingBets.has(userId)
        ) {
          return reply({ error: "You already have a bet this round" });
        }

        // atomically take the stake from the real balance. roundId on the ledger row is
        // what lets a restart work out whose stake it still owes.
        const roundId = String(round._id);
        pendingBets.add(userId);
        let updatedUser;
        try {
          updatedUser = await chargeUser(userId, bet, {
            type: TX.COINFLIP_BET,
            meta: { bet, side, roundId },
          });
        } finally {
          pendingBets.delete(userId);
        }
        if (!updatedUser) return reply({ error: "Insufficient funds" });

        await Round.updateOne(
          { _id: round._id },
          {
            $push: {
              bets: { userId, username: updatedUser.username, amount: bet, side, payout: 0 },
            },
          }
        );

        gameState[side].bets[userId] = bet;
        gameState[side].players[userId] = {
          _id: updatedUser._id,
          username: updatedUser.username,
          profilePicture: updatedUser.profilePicture,
          level: updatedUser.level,
          fixedItem: updatedUser.fixedItem,
        };

        io.to(userId.toString()).emit("userDataUpdated", {
          walletBalance: updatedUser.walletBalance,
          xp: updatedUser.xp,
          level: updatedUser.level,
        });

        io.emit("coinFlip:gameState", publicCoinState(gameState));
        reply({ ok: true });
      } catch (err) {
        console.log(err);
        reply({ error: "Could not place the bet" });
      }
    });
  });

  const calculatePayout = async (result, running) => {
    const winningSide = result === 0 ? "heads" : "tails";
    const roundId = running ? String(running._id) : null;

    for (const userId in gameState[winningSide].bets) {
      try {
        const betAmount = gameState[winningSide].bets[userId];
        const payout = winPayout(betAmount);
        const updatedUser = await creditUser(userId, payout, payout - betAmount, {
          type: TX.COINFLIP_WIN,
          meta: { betAmount, payout, side: winningSide, roundId },
        });
        if (!updatedUser) continue; // account no longer exists

        if (running) {
          await Round.updateOne(
            { _id: running._id, "bets.userId": userId },
            { $set: { "bets.$.payout": payout, "bets.$.settledAt": new Date() } }
          );
        }

        io.to(userId.toString()).emit("userDataUpdated", {
          walletBalance: updatedUser.walletBalance,
          xp: updatedUser.xp,
          level: updatedUser.level,
        });
      } catch (err) {
        console.log(err);
      }
    }
  };

  // a round exists before a single stake is taken, so there is always something to
  // account against. if the record cannot be written, betting stays shut rather than
  // taking money the server would have no way to give back.
  const openBetting = async () => {
    if (stopped) return;
    gameState = freshState();
    try {
      // the seed fixes the flip before any bet: players see its commitment now and the
      // seed at round end, so the result was decided in advance and cannot be steered
      const { seed, chainId, index } = await consumeNextSeed("coinflip");
      gameState.serverSeed = seed;
      gameState.serverSeedHash = sha256(seed);
      gameState.result = coinResultFromSeed(seed);
      const winningSide = gameState.result === 0 ? "heads" : "tails";
      round = await Round.create({
        game: "coinflip",
        status: "betting",
        serverSeed: seed,
        serverSeedHash: gameState.serverSeedHash,
        chainId,
        chainIndex: index,
        outcome: { result: gameState.result, winningSide },
      });
      if (stopped) return;
      bettingOpen = true;
    } catch (e) {
      console.log("coinFlip: could not open a round", e);
      round = null;
      bettingOpen = false;
      if (!stopped) nextRound = setTimeout(openBetting, retryMs); // retry rather than stall for good
      return;
    }
    io.emit("coinFlip:gameState", publicCoinState(gameState));
    nextRound = setTimeout(runRound, bettingMs); // betting window before the flip
  };

  const runRound = async () => {
    if (stopped) return;
    bettingOpen = false;
    io.emit("coinFlip:start");

    // the result was fixed by the seed at betting open; running just marks it landed, so
    // a restart tells a flip that happened from one still in its betting window
    const result = gameState.result;
    const running = round;
    if (running) {
      await Round.updateOne(
        { _id: running._id },
        { $set: { status: "running", startedAt: new Date() } }
      ).catch((e) => console.log(e));
    }

    reveal = setTimeout(async () => {
      if (stopped) return;
      io.emit("coinFlip:result", result);
      // the seed is revealed only now, so nobody could have known the flip early
      io.emit("coinFlip:reveal", {
        roundId: running ? String(running._id) : null,
        serverSeed: gameState.serverSeed,
        serverSeedHash: gameState.serverSeedHash,
        result,
      });

      await calculatePayout(result, running);

      if (running) {
        await Round.updateOne(
          { _id: running._id },
          { $set: { status: "settled", settledAt: new Date() } }
        ).catch((e) => console.log(e));
      }

      openBetting();
    }, revealMs);
  };

  openBetting();

  // stops the loop cleanly. the process exiting mid-round is exactly what the round
  // record exists to survive, but there is no reason to thrash on the way out.
  return () => {
    stopped = true;
    bettingOpen = false;
    if (nextRound) clearTimeout(nextRound);
    if (reveal) clearTimeout(reveal);
  };
};

module.exports = coinFlip;
// exposed for unit testing
module.exports.winPayout = winPayout;
module.exports.COINFLIP_RTP = COINFLIP_RTP;
module.exports.MIN_BET = MIN_BET;
