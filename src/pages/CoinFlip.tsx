import { useContext, useEffect, useState } from "react";
import SocketConnection from "../services/socket"
import Coin from "../components/coin/Coin"
import { motion } from "framer-motion";
import UserContext from "../UserContext";

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
  const [gameEnded, setGameEnded] = useState(false);
  const [countDown, setCountDown] = useState(0);
  const [userGambled, setUserGambled] = useState(false);
  const { isLogged, toogleUserData, userData } = useContext(UserContext);

  const handleBet = () => {
    socket.emit("coinFlip:bet", bet);
    socket.emit("coinFlip:choice", choice);

    toogleUserData({ ...userData, walletBalance: userData.walletBalance - bet });
    setUserGambled(true);
  };

  useEffect(() => {
    const startListener = () => {
      setResult(null);
      setSpinning(true); // Start spinning when the game starts
      setCountDown(0); // Reset the countdown
      setGameEnded(false); // The game has started
    };

    const resultListener = (result: number) => {
      setResult(result);
      setSpinning(false); // Stop spinning when the result is known

      // Update the user's balance based on whether they won or lost
      if (userGambled && result == choice) {
        // The user won the game, double their bet
        toogleUserData({ ...userData, walletBalance: userData.walletBalance + (bet * 2) });
      }
      setChoice(null);

      //wait 1 second before adding the result to the history
      setTimeout(() => {
        setHistory((prevHistory) => [...prevHistory, { result }]);
        setGameEnded(true); // The game has ended
        setCountDown(11.7); // Start the countdown until the next game starts
      }, 1200);

      setUserGambled(false); // Reset after each game
    };

    socket.on("coinFlip:start", startListener);
    socket.on("coinFlip:result", resultListener);

    return () => {
      // Clean up listeners when the component is unmounted
      socket.off("coinFlip:start", startListener);
      socket.off("coinFlip:result", resultListener);
    };
  }, [choice, bet, userGambled]);


  useEffect(() => {
    if (countDown > 0 && !spinning) {
      setTimeout(() => {
        setCountDown(countDown - 0.1);
      }, 100);
    }
  }, [countDown]);

  return (
    <div className="w-screen flex flex-col items-center justify-center">
      <div className="flex bg-[#212031]  rounded">
        <div className="w-[340px] flex flex-col items-center gap-4 border-r border-gray-700 py-4 px-6">
          <input
            type="number"
            value={bet}
            onChange={(e) => setBet(Number(e.target.value))}
            className="p-2 border rounded w-full"
          />

          <div className="flex flex-col gap-2 w-full">
            <label className="text-lg font-semibold">Choose a side</label>
            <div className="flex items-center justify-between gap-2 w-full">
              {
                [{
                  name: "Heads",
                  color: "red",
                  id: 0
                }, {
                  name: "Tails",
                  color: "green",
                  id: 1
                }
                ].map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setChoice(e.id)}
                    className={`p-2 border rounded w-1/2 bg-${e.color}-500 ${choice === e.id && "bg-opacity-50"}`}
                  >
                    {e.name}
                  </button>
                ))
              }
            </div></div>
          <button onClick={handleBet} className=" p-2 border rounded bg-indigo-600 hover:bg-indigo-700 w-full mt-4" disabled={
            choice === null || bet === 0 || !isLogged || userGambled || userData.walletBalance < bet || spinning
          }>
            {
              !isLogged ? "Login to play" : spinning ? "Spinning..." : choice === null ? "Choose a side" : bet === 0 ? "Place a bet" : userGambled ? "You're in!" : userData.walletBalance < bet ? "Not enough money" : "Enter the Game"
            }
          </button>
        </div>
        <div className="flex flex-col">
          <div className="flex w-[800px] border-b border-gray-700  p-4">
            <div className="flex bg-[#19172D] rounded items-center justify-center w-full h-[340px] relative ">
              {
                //div absolute to when the game ends, show how many seconds until the next game
                gameEnded && <div className="absolute top-0 left-0">
                  <span>
                    Next game in: {countDown.toFixed(1)}
                  </span>
                </div>

              }
              <Coin spinning={spinning} result={result} />
            </div>
          </div>
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
      </div >
    </div >
  );
};

export default CoinFlip;
