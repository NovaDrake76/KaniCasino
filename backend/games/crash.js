const crash = (io) => {
  const startGame = () => {
    // Emit the game start event
    io.emit("crash:start");

    // Generate a random crash multiplier between 1.00 and 10.00 (bro fix that wtf)
    const crashMultiplier = Math.random() * 9 + 1;

    // Calculate the crash duration (in milliseconds)
    const crashDuration = 3000 + (crashMultiplier - 1) * 1000;

    // Simulate the crash duration
    setTimeout(() => {
      // Emit the game crash event
      io.emit("crash:crash", crashMultiplier);

      // Schedule the next game
      setTimeout(startGame, 5000);
    }, crashDuration);
  };

  startGame();
};

module.exports = crash;
