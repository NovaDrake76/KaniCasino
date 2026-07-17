const Round = require("../models/Round");
const { chargeUser, creditUser, TX } = require("../utils/economy");
const { multiplierAt, crashPointFromSeed } = require("../utils/crashMath");
const { consumeNextSeed } = require("../utils/gameChain");
const { sha256 } = require("../utils/hashChain");

const freshState = () => ({
  gameBets: {},
  gamePlayers: {},
  crashPoint: 1.0,
  gameStartTime: null,
  serverSeed: null, // the round's seed, kept secret until the round ends
  serverSeedHash: null, // its commitment, public from betting open
});

// the crash point never goes on the wire until the round ends. the serverSeedHash is
// safe: it is a one-way commitment, and the crash point cannot be derived from it.
const publicState = (state) => ({
  gameBets: state.gameBets,
  gamePlayers: state.gamePlayers,
  gameStartTime: state.gameStartTime,
  serverSeedHash: state.serverSeedHash,
});

// the timings are arguments so a test can run a whole round in milliseconds against a
// real database. faking the clock instead breaks the mongo driver's own timers.
const crashGame = (io, { bettingMs = 12000, tickMs = 80, retryMs = 2000 } = {}) => {
  let gameState = freshState();
  // the persisted record of the round being played. bets refuse to open without one:
  // taking a stake we cannot account for later is the thing this exists to stop.
  let round = null;
  // bets are only accepted in the window between rounds
  let bettingOpen = false;
  // a socket can emit twice in one tick: the guards below only close once the db
  // call returns, so track who is mid-charge/mid-cashout and reject the duplicate
  const pendingBets = new Set();
  const pendingCashouts = new Set();
  // the round loop runs forever, so it needs a way out: without one a restart or a test
  // leaves it looping against a database that is no longer there
  let stopped = false;
  let nextRound = null;
  let ticker = null;

  io.on("connection", (socket) => {
    socket.on("crash:bet", async (bet, callback) => {
      // the client used to get no answer at all when a bet was refused
      const reply = (result) => {
        if (typeof callback === "function") callback(result);
      };

      try {
        const userId = socket.userId;
        if (!userId) return reply({ error: "You must be logged in to bet" });
        if (!bettingOpen || !round) return reply({ error: "Betting is closed for this round" });

        if (!Number.isInteger(bet) || bet < 1 || bet > 1000000) {
          return reply({ error: "Invalid bet amount" });
        }

        // one bet per round
        if (gameState.gameBets.hasOwnProperty(userId) || pendingBets.has(userId)) {
          return reply({ error: "You already have a bet this round" });
        }

        // atomically take the stake from the real balance (crash grants no xp).
        // roundId on the ledger row is what lets a restart work out who to give back.
        const roundId = String(round._id);
        pendingBets.add(userId);
        let updatedUser;
        try {
          updatedUser = await chargeUser(userId, bet, {
            awardXp: false,
            type: TX.CRASH_BET,
            meta: { bet, roundId },
          });
        } finally {
          pendingBets.delete(userId);
        }
        if (!updatedUser) {
          return reply({ error: "Insufficient funds" });
        }

        // the round may have started while the charge was in flight; the stake is
        // already gone, so record it and let the reveal or the boot sweep settle it
        await Round.updateOne(
          { _id: round._id },
          {
            $push: {
              bets: { userId, username: updatedUser.username, amount: bet, payout: 0 },
            },
          }
        );

        gameState.gameBets[userId] = bet;
        gameState.gamePlayers[userId] = {
          _id: updatedUser._id,
          username: updatedUser.username,
          profilePicture: updatedUser.profilePicture,
          level: updatedUser.level,
          fixedItem: updatedUser.fixedItem,
          payout: null,
        };

        io.to(userId.toString()).emit("userDataUpdated", {
          walletBalance: updatedUser.walletBalance,
          xp: updatedUser.xp,
          level: updatedUser.level,
        });

        io.emit("crash:gameState", publicState(gameState));
        reply({ ok: true });
      } catch (err) {
        console.log(err);
        reply({ error: "Could not place the bet" });
      }
    });

    socket.on("crash:cashout", async (callback) => {
      const done = () => {
        if (typeof callback === "function") callback();
      };

      try {
        const userId = socket.userId;
        const player = userId && gameState.gamePlayers[userId];

        // must have an active, not-yet-cashed-out bet
        if (!userId || !player || player.payout != null || pendingCashouts.has(userId)) {
          return done();
        }

        const multiplier = calculateMultiplier();

        if (multiplier < gameState.crashPoint) {
          const betAmount = gameState.gameBets[userId];
          const payout = betAmount * multiplier;

          // claim the cashout before paying: a second emit in the same tick must
          // not be paid again while this credit is still in flight
          const roundId = round ? String(round._id) : null;
          pendingCashouts.add(userId);
          let updatedUser;
          try {
            updatedUser = await creditUser(userId, payout, payout - betAmount, {
              type: TX.CRASH_CASHOUT,
              meta: { betAmount, multiplier, roundId },
            });
          } finally {
            pendingCashouts.delete(userId);
          }
          if (!updatedUser) {
            return done(); // account is gone; leave the bet uncashed
          }

          if (round) {
            await Round.updateOne(
              { _id: round._id, "bets.userId": userId },
              { $set: { "bets.$.payout": payout, "bets.$.multiplier": multiplier, "bets.$.settledAt": new Date() } }
            );
          }

          // keep the player visible with their locked-in payout
          player.payout = multiplier;

          io.to(userId.toString()).emit("userDataUpdated", {
            walletBalance: updatedUser.walletBalance,
            xp: updatedUser.xp,
            level: updatedUser.level,
          });

          io.emit("crash:gameState", publicState(gameState));

          socket.emit("crash:cashoutSuccess", { userId, payout, multiplier });
        }

        return done();
      } catch (err) {
        console.log(err);
        return done();
      }
    });
  });

  const calculateMultiplier = () => {
    if (!gameState.gameStartTime) return 1.0; // no round running

    const timeElapsed = (Date.now() - gameState.gameStartTime) / 1000; // seconds
    return multiplierAt(timeElapsed, gameState.crashPoint);
  };

  // a round exists before a single stake is taken, so there is always something to
  // account against. if the record cannot be written, betting simply stays shut rather
  // than taking money the server would have no way to give back.
  const openBetting = async () => {
    if (stopped) return;
    gameState = freshState();
    try {
      // the seed fixes the crash point before any bet: players see its commitment now and
      // the seed at round end, so the outcome was decided in advance and cannot be steered.
      const { seed, chainId, index } = await consumeNextSeed("crash");
      gameState.serverSeed = seed;
      gameState.serverSeedHash = sha256(seed);
      gameState.crashPoint = crashPointFromSeed(seed);
      round = await Round.create({
        game: "crash",
        status: "betting",
        serverSeed: seed,
        serverSeedHash: gameState.serverSeedHash,
        chainId,
        chainIndex: index,
        outcome: { crashPoint: gameState.crashPoint },
      });
      if (stopped) return;
      bettingOpen = true;
    } catch (e) {
      console.log("crash: could not open a round", e);
      round = null;
      bettingOpen = false;
      if (!stopped) nextRound = setTimeout(openBetting, retryMs); // retry rather than stall for good
      return;
    }
    io.emit("crash:gameState", publicState(gameState));
    nextRound = setTimeout(runRound, bettingMs); // betting window before the round starts
  };

  const runRound = async () => {
    if (stopped) return;
    bettingOpen = false;
    io.emit("crash:start");

    // the crash point was fixed by the seed at betting open, so the round just starts;
    // it stays server side until the reveal
    gameState.gameStartTime = Date.now();
    const running = round;
    if (running) {
      await Round.updateOne(
        { _id: running._id },
        { $set: { status: "running", startedAt: new Date() } }
      ).catch((e) => console.log(e));
    }

    const multiplierInterval = setInterval(async () => {
      if (stopped) return clearInterval(multiplierInterval);
      const currentMultiplier = calculateMultiplier();

      if (currentMultiplier >= gameState.crashPoint) {
        clearInterval(multiplierInterval);
        io.emit("crash:result", gameState.crashPoint);
        // the seed is revealed only now, so nobody could have derived the outcome early
        io.emit("crash:reveal", {
          roundId: running ? String(running._id) : null,
          serverSeed: gameState.serverSeed,
          serverSeedHash: gameState.serverSeedHash,
          crashPoint: gameState.crashPoint,
        });

        // the round is over: whoever did not cash out lost it fairly, which is what
        // separates a settled round from one a restart has to hand back
        if (running) {
          await Round.updateOne(
            { _id: running._id },
            { $set: { status: "settled", settledAt: new Date() } }
          ).catch((e) => console.log(e));
        }

        openBetting();
      } else {
        io.emit("crash:multiplier", currentMultiplier);
      }
    }, tickMs);
    ticker = multiplierInterval;
  };

  openBetting();

  // stops the loop cleanly. the process exiting mid-round is exactly what the round
  // record exists to survive, but there is no reason to thrash on the way out.
  return () => {
    stopped = true;
    bettingOpen = false;
    if (nextRound) clearTimeout(nextRound);
    if (ticker) clearInterval(ticker);
  };
};

module.exports = crashGame;
