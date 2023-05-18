import { useEffect, useState } from "react";
import SocketConnection from "../services/socket"
import Coin from "../components/coin/Coin"
import { motion } from "framer-motion";

const socket = SocketConnection.getInstance();

interface GameHistory {
  result: number;
}

const CoinFlip = () => {
  const [bet, setBet] = useState(0);
  const [choice, setChoice] = useState(null as number | null);
  const [result, setResult] = useState(null as number | null);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [spinning, setSpinning] = useState(false);

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
      setSpinning(true); // Start spinning when the game starts
    });

    socket.on("coinFlip:result", (result: number) => {
      console.log("Coin Flip result:", result);
      setResult(result);
      setSpinning(false); // Stop spinning when the result is known
      //wait 1 second before adding the result to the history
      setTimeout(() => {
        setHistory((prevHistory) => [...prevHistory, { result }]);
      }, 1200);

    });

    return () => {
      // Clean up listeners when the component is unmounted
      socket.off("coinFlip:start");
      socket.off("coinFlip:result");
    };
  }, []);

  return (
    <div className="w-screen flex flex-col items-center justify-center">
      <div className="flex bg-[#212031]  rounded">
        <form onSubmit={handleBet} className="w-[340px] flex flex-col items-center gap-4 border-r border-gray-700 py-4 px-6">
          <input
            type="number"
            value={bet}
            onChange={(e) => setBet(Number(e.target.value))}
            className="p-2 border rounded w-full"
          />

          <div className="flex flex-col gap-2 w-full">
            <label className="text-lg font-semibold">Choose a side</label>
            <div className="flex items-center justify-between gap-2 w-full">

              <button
                onClick={() => handleChoice(0)}
                className="p-2 border rounded w-1/2 bg-red-500"
              >
                Heads
              </button>
              <button onClick={() => handleChoice(1)} className="p-2 border rounded w-1/2 bg-green-500">
                Tails
              </button>
            </div></div>
          <button type="submit" className=" p-2 border rounded bg-indigo-600 hover:bg-indigo-700 w-full mt-4">
            Place Bet
          </button>
        </form>
        <div className="flex flex-col">
          <div className="flex w-[800px] border-b border-gray-700  p-4">
            <div className="flex bg-[#19172D] rounded items-center justify-center w-full h-[340px]">
              <Coin spinning={spinning} result={result} />
            </div>


          </div>
          {/* <div className="">
            {result !== null && (
              <h2 className="text-2xl">
                The result was {result === 0 ? "Heads" : "Tails"}!
              </h2>
            )}
          </div> */}

          <div className="flex  w-[800px] p-4 flex-col">
            <h3 className="mb-2 text-lg font-semibold">Game History:</h3>
            <div className="flex items-center gap-2 justify-end w-full  overflow-hidden h-[24px]">
              {history.map((e, i) => (
                <motion.div
                  key={i}
                  className={`min-w-[24px] min-h-[24px] rounded-full ${e.result === 0 ? "bg-red-500" : "bg-green-500"}`}
                  initial={i === history.length - 1 ? { opacity: 0, x: 30 } : {}} // If this is the newest result, initialize animation state
                  animate={i === history.length - 1 ? { opacity: 1, x: 0 } : {}} // If this is the newest result, set final animation state
                  transition={{ ease: "easeOut", duration: 1 }}
                />
              ))}
            </div>

          </div>
        </div>



      </div>
    </div>
  );
};

export default CoinFlip;
