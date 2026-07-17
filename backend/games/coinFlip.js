const { chargeUser, creditUser, TX } = require("../utils/economy");

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
        const payout = winPayout(betAmount);
        const updatedUser = await creditUser(userId, payout, payout - betAmount, {
          type: TX.COINFLIP_WIN,
          meta: { betAmount, payout, side: winningSide },
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
// exposed for unit testing
module.exports.winPayout = winPayout;
module.exports.COINFLIP_RTP = COINFLIP_RTP;
module.exports.MIN_BET = MIN_BET;
