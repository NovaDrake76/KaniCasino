const crypto = require("crypto");
const { chargeUser, creditUser, TX } = require("../utils/economy");
const { multiplierAt, crashPointFromRandom, INSTANT_CRASH_CHANCE } = require("../utils/crashMath");

const freshState = () => ({
  gameBets: {},
  gamePlayers: {},
  crashPoint: 1.0,
  gameStartTime: null,
});

// the crash point is the one secret a round holds, so it never goes on the wire until
// the round is over and `crash:result` reveals it. broadcasting the whole state used to
// hand it to every connected client the moment anyone cashed out: everyone still in the
// round could then bail one tick before the bust, every time.
const publicState = (state) => ({
  gameBets: state.gameBets,
  gamePlayers: state.gamePlayers,
  gameStartTime: state.gameStartTime,
});

const crashGame = (io) => {
  let gameState = freshState();
  // bets are only accepted in the window between rounds
  let bettingOpen = true;
  // a socket can emit twice in one tick: the guards below only close once the db
  // call returns, so track who is mid-charge/mid-cashout and reject the duplicate
  const pendingBets = new Set();
  const pendingCashouts = new Set();

  io.on("connection", (socket) => {
    socket.on("crash:bet", async (bet, callback) => {
      // the client used to get no answer at all when a bet was refused
      const reply = (result) => {
        if (typeof callback === "function") callback(result);
      };

      try {
        const userId = socket.userId;
        if (!userId) return reply({ error: "You must be logged in to bet" });
        if (!bettingOpen) return reply({ error: "Betting is closed for this round" });

        if (!Number.isInteger(bet) || bet < 1 || bet > 1000000) {
          return reply({ error: "Invalid bet amount" });
        }

        // one bet per round
        if (gameState.gameBets.hasOwnProperty(userId) || pendingBets.has(userId)) {
          return reply({ error: "You already have a bet this round" });
        }

        // atomically take the stake from the real balance (crash grants no xp)
        pendingBets.add(userId);
        let updatedUser;
        try {
          updatedUser = await chargeUser(userId, bet, {
            awardXp: false,
            type: TX.CRASH_BET,
            meta: { bet },
          });
        } finally {
          pendingBets.delete(userId);
        }
        if (!updatedUser) {
          return reply({ error: "Insufficient funds" });
        }

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
          pendingCashouts.add(userId);
          let updatedUser;
          try {
            updatedUser = await creditUser(userId, payout, payout - betAmount, {
              type: TX.CRASH_CASHOUT,
              meta: { betAmount, multiplier },
            });
          } finally {
            pendingCashouts.delete(userId);
          }
          if (!updatedUser) {
            return done(); // account is gone; leave the bet uncashed
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

  const runRound = () => {
    bettingOpen = false;
    io.emit("crash:start");

    gameState.crashPoint = calculateCrashPoint();
    gameState.gameStartTime = Date.now();

    const multiplierInterval = setInterval(() => {
      const currentMultiplier = calculateMultiplier();

      if (currentMultiplier >= gameState.crashPoint) {
        clearInterval(multiplierInterval);
        io.emit("crash:result", gameState.crashPoint);

        // reset and reopen betting for the next round
        gameState = freshState();
        bettingOpen = true;
        io.emit("crash:gameState", publicState(gameState));

        setTimeout(runRound, 12000); // betting window before the next round
      } else {
        io.emit("crash:multiplier", currentMultiplier);
      }
    }, 80);
  };

  const calculateCrashPoint = () => {
    const h = crypto.getRandomValues(new Uint32Array(1))[0];
    let crashPoint = crashPointFromRandom(h);

    // small chance to crash instantly
    if (Math.random() < INSTANT_CRASH_CHANCE) {
      crashPoint = 1.0;
    }

    return crashPoint;
  };

  // open an initial betting window, then start the first round
  setTimeout(runRound, 12000);
};

module.exports = crashGame;
