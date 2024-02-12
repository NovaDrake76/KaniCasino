import { useContext, useEffect, useState } from "react";
import SocketConnection from "../../services/socket"
import UserContext from "../../UserContext";
import falling from "/images/crash/falling.gif";
import idle from "/images/crash/idle.gif";
import up from "/images/crash/up.gif";
import LiveBets from "./LiveBets";
import GameContainer from "./GameContainer";
import SideMenu from "./SideMenu";

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

  const { isLogged, toogleUserData, userData, toogleUserFlow } = useContext(UserContext);

  const handleBet = () => {
    if (!isLogged) {
      toogleUserFlow();
      return;
    }

    if (bet === null || bet < 1) return;
    const user = [{
      id: userData?.id,
      name: userData?.username,
      profilePicture: userData?.profilePicture,
      level: userData?.level,
      fixedItem: userData?.fixedItem,
      payout: null,
      walletBalance: userData?.walletBalance
    }]
    setUserGambled(true);

    socket.emit("crash:bet", user[0], bet);
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
        <SideMenu bet={bet} setBet={setBet} gameStarted={gameStarted} handleBet={handleBet} handleCashout={handleCashout} isLogged={isLogged} userGambled={userGambled} userCashedOut={userCashedOut} userData={userData} userMultiplier={userMultiplier} />
        <GameContainer
          crashPoint={crashPoint}
          multiplier={multiplier}
          animationSrc={animationSrc}
          gameEnded={gameEnded}
          countDown={countDown}
          setAnimationSrc={setAnimationSrc}
          up={up}
          idle={idle}
          falling={falling}
          history={history} />
      </div>


      <LiveBets gameState={gameState} />

    </div >
  );
};

export default CrashGame;
