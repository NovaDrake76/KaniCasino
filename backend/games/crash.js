const User = require("../models/User");

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
        if (isNaN(bet) || bet < 0) {
          return res.status(400).json({ message: "Invalid bet" });
        }

        gameState.gameBets[user.id] = bet;

        // Update player balance
        const updatedUser = await User.findByIdAndUpdate(
          user.id,
          { $inc: { walletBalance: -bet } },
          { new: true }
        ).select("-password").select("-email").select("-isAdmin").select("-nextBonus").select("-xp").select("-inventory").select("-walletBalance");

        // After updating the user, add them to the game state
        gameState.gamePlayers[user.id] = updatedUser;

        // Emit the updated game state to all clients
        io.emit("crash:gameState", gameState);
      } catch (err) {
        console.log(err);
      }
    });

    socket.on("crash:cashout", (user) => {
      // Handle player cashout

      // Calculate payout based on the current multiplier (should be real time from the client's view)
      let multiplier = calculateMultiplier();

      if (multiplier < gameState.crashPoint) {
        // Player successfully cashed out before crash
        const betAmount = gameState.gameBets[user.id];
        const payout = betAmount * multiplier;

        User.findByIdAndUpdate(
          user.id,
          { $inc: { walletBalance: payout } },
          { new: true }
        );
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

        setTimeout(async () => {
          // Reset game state
          gameState = {
            gameBets: {},
            gamePlayers: {},
            crashPoint: 1.0
          };

          setTimeout(startGame, 7000); // Delay before the next game
        }, 5000); // Delay before resetting the game state
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
