import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_BASE_URL);

interface GameHistory {
  result: number;
}

const CoinFlip = () => {
  const [bet, setBet] = useState(0);
  const [choice, setChoice] = useState(null as number | null);
  const [result, setResult] = useState(null as number | null);
  const [history, setHistory] = useState<GameHistory[]>([]);

  const handleBet = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    socket.emit("coinFlip:bet", bet);
  };

  const handleChoice = (choice: number) => {
    setChoice(choice);
    socket.emit("coinFlip:choice", choice);
  };

  useEffect(() => {
    socket.on("coinFlip:start", () => {
      console.log("Coin Flip game started");
      setChoice(null);
      setResult(null);
    });

    socket.on("coinFlip:result", (result: number) => {
      console.log("Coin Flip result:", result);
      setResult(result);
      setHistory((prevHistory) => [...prevHistory, { result }]);
    });

    return () => {
      // Clean up listeners when the component is unmounted
      socket.off("coinFlip:start");
      socket.off("coinFlip:result");
    };
  }, []);

  return (
    <div className="container mx-auto">
      <form onSubmit={handleBet} className="mb-4">
        <input
          type="number"
          value={bet}
          onChange={(e) => setBet(Number(e.target.value))}
          className="p-2 border rounded"
        />
        <button type="submit" className="ml-2 p-2 border rounded">
          Place Bet
        </button>
      </form>

      <div className="mb-4">
        <button
          onClick={() => handleChoice(0)}
          className="p-2 border rounded mr-2"
        >
          Heads
        </button>
        <button onClick={() => handleChoice(1)} className="p-2 border rounded">
          Tails
        </button>
      </div>

      <div className="mb-4">
        {result !== null && (
          <h2 className="text-2xl">
            The result was {result === 0 ? "Heads" : "Tails"}!
          </h2>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-lg font-semibold">Game History:</h3>
        {history.map((game, index) => (
          <p key={index}>
            Game {index + 1}: {game.result === 0 ? "Heads" : "Tails"}
          </p>
        ))}
      </div>
    </div>
  );
};

export default CoinFlip;
