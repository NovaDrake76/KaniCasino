const { chargeUser, creditUser, TX } = require("../utils/economy");

const freshState = () => ({
  heads: { players: {}, bets: {} },
  tails: { players: {}, bets: {} },
});

const coinFlip = (io) => {
  let gameState = freshState();
  // bets are only accepted in the window between flips
  let bettingOpen = true;
  // players whose charge is still in flight, so a duplicate emit can't get through
  const pendingBets = new Set();

  io.on("connection", (socket) => {
    socket.on("coinFlip:bet", async (bet, choice, callback) => {
      // the client used to get no answer at all when a bet was refused
      const reply = (result) => {
        if (typeof callback === "function") callback(result);
      };

      try {
        const userId = socket.userId;
        if (!userId) return reply({ error: "You must be logged in to bet" });
        if (!bettingOpen) return reply({ error: "Betting is closed for this round" });

        if (choice !== 0 && choice !== 1) return reply({ error: "Pick heads or tails" });
        if (!Number.isInteger(bet) || bet < 1 || bet > 1000000) {
          return reply({ error: "Invalid bet amount" });
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

        // atomically take the stake from the real balance
        pendingBets.add(userId);
        let updatedUser;
        try {
          updatedUser = await chargeUser(userId, bet, {
            type: TX.COINFLIP_BET,
            meta: { bet, side },
          });
        } finally {
          pendingBets.delete(userId);
        }
        if (!updatedUser) return reply({ error: "Insufficient funds" });

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
        reply({ ok: true });
      } catch (err) {
        console.log(err);
        reply({ error: "Could not place the bet" });
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
        if (!updatedUser) continue; // account no longer exists

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
