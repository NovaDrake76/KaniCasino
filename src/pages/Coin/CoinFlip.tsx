import { useContext, useEffect, useState } from "react";
import SocketConnection from "../../services/socket"
import Coin from "./Coin"
import { motion } from "framer-motion";
import UserContext from "../../UserContext";
import LiveBets from "./LiveBets";

const socket = SocketConnection.getInstance();

interface GameHistory {
  result: number;
}

const CoinFlip = () => {
  const [bet, setBet] = useState(0);
  const [_betAux, setBetAux] = useState(0);
  const [choice, setChoice] = useState(null as number | null);
  const [result, setResult] = useState<number | null>(null);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [countDown, setCountDown] = useState(0);
  const [userGambled, setUserGambled] = useState(false);
  const [gameState, setGameState] = useState<any>({
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
  });
  const { isLogged, userData, toogleUserFlow } = useContext(UserContext);

  const handleBet = () => {
    if (!isLogged) {
      toogleUserFlow();
      return;
    }


    const user = [{
      id: userData?.id,
      name: userData?.username,
      profilePicture: userData?.profilePicture,
      level: userData?.level,
      fixedItem: userData?.fixedItem,
      payout: null
    }]

    socket.emit("coinFlip:bet", user[0], bet, choice);
    socket.emit("coinFlip:choice", user[0], choice);

    setUserGambled(true);
    setBetAux(bet);
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
      setSpinning(false);

      //wait 1 second before adding the result to the history
      setTimeout(() => {
        setHistory((prevHistory) => [...prevHistory, { result }]);
        setGameEnded(true);
        setCountDown(11.4);
        setGameState({
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
        });
      }, 1200);

      setUserGambled(false);
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
    const gameStateListener = (gameState: any) => {
      setGameState(gameState);

    };

    socket.on("coinFlip:gameState", gameStateListener);


    return () => {
      socket.off("coinFlip:gameState", gameStateListener);
    };
  }, []);


  useEffect(() => {
    if (countDown > 0.1 && !spinning) {
      setTimeout(() => {
        setCountDown(countDown - 0.1);
      }, 100);
    }
  }, [countDown]);

  return (
    <div className="w-screen flex flex-col items-center justify-center gap-12">
      <div className="flex bg-[#212031] rounded flex-col lg:flex-row">
        <div className="lg:w-[340px] flex flex-col items-center gap-4 border-r border-gray-700 py-4 px-6">
          <input
            type="number"
            value={bet}
            onKeyDown={(event) => {
              if (!/[0-9]/.test(event.key) && event.key !== "Backspace") {
                event.preventDefault();
              }
            }}
            onChange={(e) => {
              const value = Number(e.target.value);
              setBet(value < 0 ? 0 : value);
            }}
            className="p-2 border rounded w-1/2 lg:w-full"
          />
          <div className="flex flex-col gap-2 w-full">
            <label className="text-lg font-semibold">Choose a side</label>
            <div className="flex items-center justify-between gap-2 w-full flex-col lg:flex-row">
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
                    className={`p-2 border rounded w-1/2 bg-${e.color}-500 ${choice === e.id && "bg-opacity-30"}`}
                  >
                    {e.name}
                  </button>
                ))
              }
            </div></div>
          <button onClick={handleBet} className=" p-2 border rounded bg-indigo-600 hover:bg-indigo-700 w-full mt-4" disabled={
            choice === null || bet === 0 || userGambled || (userData !== null && userData.walletBalance < bet) || spinning || bet > 1000000
          }>
            {

              spinning ? "Spinning..."
                : choice === null ? "Choose a side"
                  : bet === 0 ? "Place the bet value"
                    : bet > 1000000 ? "Max bet is 1M"
                      : userGambled ? "You're in!"
                        : userData !== null && userData.walletBalance < bet ? "Not enough money"
                          : "Enter the Game"
            }
          </button>
        </div>
        <div className="flex flex-col">
          <div className="flex lg:w-[800px] border-b border-gray-700  p-4">
            <div className="flex bg-[#19172D] rounded items-center justify-center w-full h-[340px] relative ">
              {
                gameEnded && <div className="absolute top-0 left-0 p-2">
                  <span>
                    Next game in: {countDown.toFixed(1)}
                  </span>
                </div>
              }
              <Coin spinning={spinning} result={result} />
            </div>
          </div>
          <div className="flex w-screen lg:w-[800px] p-4 flex-col">
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
      <div className="flex gap-8 flex-col lg:flex-row">
        {gameState &&
          ["Heads", "Tails"].map((e, i) => (
            <LiveBets gameState={gameState} type={e} key={i} />
          ))
        }
      </div>

    </div >
  );
};

export default CoinFlip;
