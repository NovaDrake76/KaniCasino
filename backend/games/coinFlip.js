const coinFlip = (io) => {
  const startGame = () => {
    io.emit("coinFlip:start");

    const result = Math.floor(Math.random() * 2);

    setTimeout(() => {
      io.emit("coinFlip:result", result);

      setTimeout(startGame, 5000);
    }, 3000);
  };

  startGame();
};

module.exports = coinFlip;
