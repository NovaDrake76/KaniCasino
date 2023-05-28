const User = require("../models/User");

const coinFlip = (io) => {
  let gameState = {
    heads: {
      players: {},
      bets: {},
      choices: {},
    },
    tails: {
      players: {},
      bets: {},
      choices: {},
    }
  };


  io.on("connection", (socket) => {
    socket.on("coinFlip:bet", async (user, bet, choice) => {
      try {
        // Handle player bet

        //if bet is not a number or is less than 0, return error
        if (isNaN(bet) || bet < 0) {
          return res.status(400).json({ message: "Invalid bet" });
        }

        const betType = choice === 0 ? "heads" : "tails";
        gameState[betType].bets[user.id] = bet;

        // Update player balance
        const updatedUser = await User.findByIdAndUpdate(
          user.id,
          { $inc: { walletBalance: -bet } },
          { new: true }
        ).select("-password").select("-email").select("-isAdmin").select("-nextBonus").select("-xp").select("-inventory").select("-walletBalance");

        // After updating the user, add them to the game state
        gameState[betType].players[user.id] = updatedUser;

        // Emit the updated game state to all clients
        io.emit("coinFlip:gameState", gameState);
      } catch (err) {
        console.log(err);
      }
    });



    socket.on("coinFlip:choice", (user, choice) => {
      // Handle player choice
      const choiceType = choice === 0 ? "heads" : "tails";
      gameState[choiceType].choices[user.id] = choice;

      // Emit the updated game state to all clients
      io.emit("coinFlip:gameState", gameState);
    });

  });

  const calculatePayout = async (result) => {
    let winningChoice = result === 0 ? "heads" : "tails";

    for (let userId in gameState[winningChoice].choices) {
      // Player wins, update their balance
      try {
        const betAmount = gameState[winningChoice].bets[userId];
        await User.findByIdAndUpdate(
          userId,
          { $inc: { walletBalance: betAmount * 2 } },
          { new: true }
        );
      } catch (err) {
        console.log(err);
      }
    }
  };


  const startGame = async () => {
    io.emit("coinFlip:start");

    const result = Math.floor(Math.random() * 2);

    setTimeout(async () => {
      io.emit("coinFlip:result", result);

      // Calculate payouts based on game result and player choices
      await calculatePayout(result);

      // Reset game state
      gameState = {
        heads: {
          players: {},
          bets: {},
          choices: {},
        },
        tails: {
          players: {},
          bets: {},
          choices: {},
        }
      };

      setTimeout(startGame, 14000);
    }, 5000);
  };

  startGame();
};

module.exports = coinFlip;
