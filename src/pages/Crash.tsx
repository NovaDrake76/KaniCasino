import { useContext, useEffect, useState } from "react";
import SocketConnection from "../services/socket"
import { motion } from "framer-motion";
import UserContext from "../UserContext";
import falling from "/images/crash/falling.gif";
import idle from "/images/crash/idle.gif";
import up from "/images/crash/up.gif";
import LiveBets from "../components/crash/LiveBets";

import Videos from "../components/crash/Videos";
const socket = SocketConnection.getInstance();

interface GameHistory {
  crashPoint: number;
}

const CrashGame = () => {
  const [bet, setBet] = useState<number | null>(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState(null as number | null);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [gameStarted, setGameStarted] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [countDown, setCountDown] = useState(0);
  const [userGambled, setUserGambled] = useState(false);
  const [userMultiplier, setUserMultiplier] = useState(0);
  const [animationSrc, setAnimationSrc] = useState(idle);
  const [userCashedOut, setUserCashedOut] = useState(false);
  const [gameState, setGameState] = useState<any>({
    gameBets: {},
    gamePlayers: {},
    crashPoint: 1.0,
    gameStartTime: null,
  });

  const { isLogged, toogleUserData, userData } = useContext(UserContext);

  const handleBet = () => {
    if (bet === null || bet < 1) return;
    const user = [{
      id: userData?.id,
      name: userData?.username,
      profilePicture: userData?.profilePicture,
      level: userData?.level,
      fixedItem: userData?.fixedItem,
      payout: null
    }]
    setUserGambled(true);

    socket.emit("crash:bet", user[0], bet);

    toogleUserData({ ...userData, walletBalance: userData.walletBalance - bet! });
    setUserCashedOut(false);
  };

  const handleCashout = () => {
    const user = {
      id: userData?.id,
      name: userData?.username,
      profilePicture: userData?.profilePicture,
      level: userData?.level,
      fixedItem: userData?.fixedItem,
      payout: null
    };

    socket.emit("crash:cashout", user);
  };

  useEffect(() => {
    const cashoutSuccessListener = (data: any) => {
      setUserMultiplier(data.multiplier);
      setUserCashedOut(true);

      toogleUserData({ ...userData, walletBalance: data.updatedUser.walletBalance });
    };

    socket.on("crash:cashoutSuccess", cashoutSuccessListener);

    return () => {
      socket.off("crash:cashoutSuccess", cashoutSuccessListener);
    };
  }, [userData, toogleUserData]);

  useEffect(() => {
    const gameStateListener = (gameState: any) => {
      setGameState(gameState);
    };

    socket.on("crash:gameState", gameStateListener);


    return () => {
      socket.off("crash:gameState", gameStateListener);
    };
  }, []);


  useEffect(() => {
    const startListener = () => {
      setAnimationSrc(up);

      setMultiplier(1.0);
      setCrashPoint(null);
      setGameStarted(true);
      setGameEnded(false);
      setUserCashedOut(false);
      setUserMultiplier(0);
      setCountDown(0); // Reset the countdown

    };

    let timeoutId: NodeJS.Timeout;

    const resultListener = (crashPoint: number) => {
      setAnimationSrc(falling);
      setCrashPoint(crashPoint);

      setGameStarted(false);
      setGameState({
        gameBets: {},
        gamePlayers: {},
        crashPoint: 1.0,
        gameStartTime: null,
      });

      setUserGambled(false);

      if (!userCashedOut && multiplier >= crashPoint) {
        // The user did not cash out in time and lost their bet
        setMultiplier(crashPoint);
      }

      setHistory((prevHistory) => [...prevHistory, { crashPoint }]);
      setGameEnded(true);
      setCountDown(10.7);

      timeoutId = setTimeout(() => setAnimationSrc(idle), 700);
    };


    socket.on("crash:start", startListener);
    socket.on("crash:result", resultListener);

    return () => {
      // Clean up listeners when the component is unmounted
      socket.off("crash:start", startListener);
      socket.off("crash:result", resultListener);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [multiplier, userCashedOut]);

  useEffect(() => {
    const multiplierListener = (multiplier: number) => {
      setMultiplier(multiplier);
    };

    socket.on("crash:multiplier", multiplierListener);

    return () => {
      socket.off("crash:multiplier", multiplierListener);
    };
  }, []);


  useEffect(() => {
    if (countDown > 0.1 && !gameStarted) {
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
            value={bet || ""}
            onKeyDown={(event) => {
              if (!/[0-9]/.test(event.key) && event.key !== "Backspace") {
                event.preventDefault();
              }
            }}
            onChange={(e) => setBet(Number(e.target.value))}
            className="p-2 border rounded w-1/2 lg:w-full"
          />
          <button
            onClick={gameStarted ? handleCashout : handleBet}
            className="p-2 border rounded bg-indigo-600 hover:bg-indigo-700 w-full mt-4"
            disabled={
              !isLogged ||
              (gameStarted && (!userGambled || userCashedOut)) ||
              (!gameStarted && userGambled)
            }
          >
            {!isLogged
              ? "Login to play"
              : userCashedOut
                ? `Cashed Out at x${userMultiplier.toFixed(2)}`
                : userGambled
                  ? (gameStarted ? "Cash Out" : "You're in!")
                  : gameStarted
                    ? "Wait for next round"
                    : bet === 0 || !bet || bet < 1
                      ? "Place the bet value"
                      : userData.walletBalance < bet!
                        ? "Not enough money"
                        : "Place Bet"
            }
          </button>

        </div>
        <div className="flex flex-col">
          <div className="flex lg:w-[800px] border-b border-gray-700  p-4">
            <div className="flex bg-[#19172D] rounded items-center flex-col  justify-center w-full h-[340px] relative ">
              {
                gameEnded && <div className="absolute top-0 left-0 p-2">
                  <span>
                    Next game in: {countDown.toFixed(1)}
                  </span>
                </div>
              }
              <div className={`font-semibold p-4 min-w-[250px] rounded text-2xl flex items-center z-10 justify-center -mt-32 ${gameEnded ? "bg-red-500" : "bg-[#212031] "}`}>
                {
                  gameEnded ? <span>Crashed at {crashPoint && crashPoint.toFixed(2)}X</span>
                    : <div className="flex items-center justify-between w-[93%] ">
                      <span>Multiplier:</span> {multiplier.toFixed(2)}X</div>}

              </div>
              <Videos
                animationSrc={animationSrc}
                setAnimationSrc={setAnimationSrc}
                up={up}
                idle={idle}
                falling={falling} />
            </div>
          </div>
          <div className="flex w-screen lg:w-[800px] p-4 flex-col">
            <h3 className="mb-2 text-lg font-semibold">Game History:</h3>
            <div className="flex items-center gap-2 justify-end w-full overflow-hidden h-[24px]">
              {history.map((e, i) => (
                <motion.div
                  key={i}
                  className={`min-h-[24px] rounded-lg p-2 ${e.crashPoint < 2 ? "bg-red-500" : "bg-green-500"}`}
                  initial={i === history.length - 1 ? { opacity: 0, x: 30 } : {}}
                  animate={i === history.length - 1 ? { opacity: 1, x: 0 } : {}}
                  transition={{ ease: "easeOut", duration: 1 }}
                >
                  <span className="font-bold">{e.crashPoint}x</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>          <LiveBets gameState={gameState} />

    </div >
  );
};

export default CrashGame;
