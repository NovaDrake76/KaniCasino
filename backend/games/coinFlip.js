const { chargeUser, creditUser, TX } = require("../utils/economy");

const freshState = () => ({
  heads: { players: {}, bets: {} },
  tails: { players: {}, bets: {} },
});

const coinFlip = (io) => {
  let gameState = freshState();
  // bets are only accepted in the window between flips
  let bettingOpen = true;

  io.on("connection", (socket) => {
    socket.on("coinFlip:bet", async (bet, choice) => {
      try {
        const userId = socket.userId;
        if (!userId) return; // unauthenticated sockets can't bet
        if (!bettingOpen) return;

        if (choice !== 0 && choice !== 1) return;
        if (isNaN(bet) || bet < 1 || bet > 1000000) return;

        const side = choice === 0 ? "heads" : "tails";
        const other = choice === 0 ? "tails" : "heads";

        // one bet per round, on a single side
        if (gameState[side].bets[userId] || gameState[other].bets[userId]) {
          return;
        }

        // atomically take the stake from the real balance
        const updatedUser = await chargeUser(userId, bet, {
          type: TX.COINFLIP_BET,
          meta: { bet, side },
        });
        if (!updatedUser) return; // insufficient funds

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

        io.emit("coinFlip:gameState", gameState);
      } catch (err) {
        console.log(err);
      }
    });
  });

  const calculatePayout = async (result) => {
    const winningSide = result === 0 ? "heads" : "tails";

    for (const userId in gameState[winningSide].bets) {
      try {
        const betAmount = gameState[winningSide].bets[userId];
        const updatedUser = await creditUser(userId, betAmount * 2, betAmount, {
          type: TX.COINFLIP_WIN,
          meta: { betAmount, side: winningSide },
        });

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

  const runRound = async () => {
    bettingOpen = false;
    io.emit("coinFlip:start");

    const result = Math.floor(Math.random() * 2);

    setTimeout(async () => {
      io.emit("coinFlip:result", result);

      await calculatePayout(result);

      gameState = freshState();
      io.emit("coinFlip:gameState", gameState);
      bettingOpen = true;

      setTimeout(runRound, 14000); // betting window before the next flip
    }, 5000);
  };

  // open an initial betting window, then start the first flip
  setTimeout(runRound, 14000);
};

module.exports = coinFlip;
