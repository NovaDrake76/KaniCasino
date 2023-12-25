const User = require("../models/User");
const crypto = require("crypto");
const updateUserWinnings = require("../utils/updateUserWinnings");

const crashGame = (io) => {
  let gameState = {
    gameBets: {},
    gamePlayers: {},
    crashPoint: 1.0,
    gameStartTime: null,
  };


  io.on("connection", (socket) => {
    socket.on("crash:bet", async (user, bet) => {

      try {
        // Handle player bet

        //if bet is not a number or is less than 0, return error
        if (isNaN(bet) || bet < 1 || bet > 1000000) {
          return;
        }

        // Check if the user has the required balance
        if (user.walletBalance < bet) {
          return;
        }

        gameState.gameBets[user.id] = bet;

        // Update player balance
        const updatedUser = await User.findByIdAndUpdate(
          user.id,
          { $inc: { walletBalance: -bet } },
          { new: true }
        ).select("-password").select("-email").select("-isAdmin").select("-nextBonus").select("-inventory").select("-bonusAmount");

        const userDataPayload = {
          walletBalance: updatedUser.walletBalance,
          xp: updatedUser.xp,
          level: updatedUser.level,
        }
        io.to(user.id).emit('userDataUpdated', userDataPayload);
        // After updating the user, add them to the game state
        gameState.gamePlayers[user.id] = updatedUser;

        // Emit the updated game state to all clients
        io.emit("crash:gameState", gameState);
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("crash:cashout", async (user) => {
      // Check if the user has an existing bet
      if (!gameState.gameBets.hasOwnProperty(user.id)) {
        console.log("No bet")
        return; // If no bet exists for the user, exit the function
      }

      // Calculate payout based on the current multiplier
      let multiplier = calculateMultiplier();

      if (multiplier < gameState.crashPoint) {
        // Player successfully cashed out before crash
        const betAmount = gameState.gameBets[user.id];
        const payout = betAmount * multiplier;

        // Update the user's wallet balance and handle the returned updated user
        const updatedUser = await User.findById(
          user.id
        );

        updatedUser.walletBalance += payout;

        // Update the user's weekly winnings
        updateUserWinnings(updatedUser, (betAmount * multiplier) - betAmount);

        // Save the updated user
        await updatedUser.save();

        gameState.gamePlayers[user.id] = { ...gameState.gamePlayers[user.id]._doc, payout: multiplier }
        const userDataPayload = {
          walletBalance: updatedUser.walletBalance,
          xp: updatedUser.xp,
          level: updatedUser.level,
        }
        io.to(user.id).emit('userDataUpdated', userDataPayload);

        //update the game state
        io.emit("crash:gameState", gameState);

        // Remove the player's bet from the game state
        delete gameState.gameBets[user.id];
        delete gameState.gamePlayers[user.id];

        // Emit an event to let the client know that the cashout was successful
        socket.emit("crash:cashoutSuccess", { userId: user.id, payout, multiplier, updatedUser });
      }
    });
  });

  const calculateMultiplier = () => {
    const timeElapsed = (new Date().getTime() - gameState.gameStartTime) / 1000; // convert time to seconds

    // This will give you a multiplier that goes up exponentially with time, with a maximum of crashPoint
    // Note: You might want to adjust the constant factors (e.g., 0.005) depending on the desired speed of growth
    const multiplier = Math.min(Math.exp(timeElapsed * 0.06), gameState.crashPoint);

    return multiplier;
  };

  const startGame = async () => {
    io.emit("crash:start");

    // Set crash point
    gameState.crashPoint = calculateCrashPoint();

    // Set game start time
    gameState.gameStartTime = new Date().getTime();

    const multiplierInterval = setInterval(() => {
      const currentMultiplier = calculateMultiplier();

      if (currentMultiplier >= gameState.crashPoint) {
        // Game has crashed
        clearInterval(multiplierInterval); // stop emitting the multiplier when the game ends
        io.emit("crash:result", gameState.crashPoint);


        // Reset game state
        gameState = {
          gameBets: {},
          gamePlayers: {},
          crashPoint: 1.0
        };

        setTimeout(startGame, 12000); // Delay before the next game

      } else {
        io.emit("crash:multiplier", currentMultiplier);
      }
    }, 80); // adjust the interval as needed
  };


  const calculateCrashPoint = () => {
    const e = 2 ** 32
    const h = crypto.getRandomValues(new Uint32Array(1))[0]
    return Math.floor((100 * e - h) / (e - h)) / 100
  };

  startGame();
};


module.exports = crashGame;
