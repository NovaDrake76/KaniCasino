const crypto = require("crypto");
const { chargeUser, creditUser, TX } = require("../utils/economy");
const { multiplierAt, crashPointFromRandom, INSTANT_CRASH_CHANCE } = require("../utils/crashMath");

const freshState = () => ({
  gameBets: {},
  gamePlayers: {},
  crashPoint: 1.0,
  gameStartTime: null,
});

const crashGame = (io) => {
  let gameState = freshState();
  // bets are only accepted in the window between rounds
  let bettingOpen = true;

  io.on("connection", (socket) => {
    socket.on("crash:bet", async (bet) => {
      try {
        const userId = socket.userId;
        if (!userId) return; // unauthenticated sockets can't bet
        if (!bettingOpen) return; // round already running

        if (isNaN(bet) || bet < 1 || bet > 1000000) {
          return;
        }

        // one bet per round
        if (gameState.gameBets.hasOwnProperty(userId)) {
          return;
        }

        // atomically take the stake from the real balance (crash grants no xp)
        const updatedUser = await chargeUser(userId, bet, {
          awardXp: false,
          type: TX.CRASH_BET,
          meta: { bet },
        });
        if (!updatedUser) {
          return; // insufficient funds
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

        io.emit("crash:gameState", gameState);
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("crash:cashout", async (callback) => {
      try {
        const userId = socket.userId;
        const player = userId && gameState.gamePlayers[userId];

        // must have an active, not-yet-cashed-out bet
        if (!userId || !player || player.payout != null) {
          if (typeof callback === "function") callback();
          return;
        }

        const multiplier = calculateMultiplier();

        if (multiplier < gameState.crashPoint) {
          const betAmount = gameState.gameBets[userId];
          const payout = betAmount * multiplier;

          const updatedUser = await creditUser(userId, payout, payout - betAmount, {
            type: TX.CRASH_CASHOUT,
            meta: { betAmount, multiplier },
          });

          // keep the player visible with their locked-in payout
          gameState.gamePlayers[userId].payout = multiplier;

          io.to(userId.toString()).emit("userDataUpdated", {
            walletBalance: updatedUser.walletBalance,
            xp: updatedUser.xp,
            level: updatedUser.level,
          });

          io.emit("crash:gameState", gameState);

          socket.emit("crash:cashoutSuccess", { userId, payout, multiplier });
        }

        if (typeof callback === "function") callback();
      } catch (err) {
        console.log(err);
        if (typeof callback === "function") callback();
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
        io.emit("crash:gameState", gameState);

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
