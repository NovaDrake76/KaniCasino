import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
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
  const [userCashedOut, setUserCashedOut] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [gameState, setGameState] = useState<any>({
    gameBets: {},
    gamePlayers: {},
    crashPoint: 1.0,
    gameStartTime: null,
  });

  const { isLogged, toogleUserData, userData, toogleUserFlow } = useContext(UserContext);

  const handleBet = () => {
    if (!isLogged) {
      toogleUserFlow(true);
      return;
    }

    if (bet === null || bet < 1) return;
    setUserGambled(true);
    setUserCashedOut(false);

    // the server has the final word: a refused bet used to leave the ui claiming
    // the player was in the round
    socket.emit("crash:bet", bet, (result: { ok?: boolean; error?: string }) => {
      if (result?.error) {
        setUserGambled(false);
        toast.error(result.error);
      }
    });
  };

  const handleCashout = () => {
    setDisableButton(true); // Disable the button immediately

    socket.emit("crash:cashout", () => {
      setDisableButton(false); // Re-enable the button after the server responds
    });
  };

  useEffect(() => {
    const cashoutSuccessListener = (data: any) => {
      setUserMultiplier(data.multiplier);
      setUserCashedOut(true);
      setDisableButton(false); // Ensure the button is enabled after a successful cashout
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

  // sync to a round already in progress on entry, so joining mid-round does not sit at
  // 1x with the idle animation until the next game. asks the server, and also catches the
  // server's own emit on (re)connect.
  useEffect(() => {
    const syncListener = (sync: any) => {
      setGameState({
        gameBets: sync.gameBets || {},
        gamePlayers: sync.gamePlayers || {},
        crashPoint: 1.0,
        gameStartTime: sync.gameStartTime || null,
      });
      if (sync.phase === "running") {
        setGameStarted(true);
        setGameEnded(false);
      } else if (sync.phase === "betting") {
        setGameStarted(false);
        setGameEnded(false);
      }
    };

    socket.on("crash:sync", syncListener);
    socket.emit("crash:requestState");

    return () => {
      socket.off("crash:sync", syncListener);
    };
  }, []);

  useEffect(() => {
    const startListener = () => {
      setMultiplier(1.0);
      setCrashPoint(null);
      setGameStarted(true);
      setGameEnded(false);
      setUserCashedOut(false);
      setUserMultiplier(0);
      setCountDown(0); // Reset the countdown
    };

    const resultListener = (crashPoint: number) => {
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
    };

    socket.on("crash:start", startListener);
    socket.on("crash:result", resultListener);

    return () => {
      // Clean up listeners when the component is unmounted
      socket.off("crash:start", startListener);
      socket.off("crash:result", resultListener);
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
        <SideMenu bet={bet} setBet={setBet} gameStarted={gameStarted} handleBet={handleBet} handleCashout={handleCashout}
         isLogged={isLogged} userGambled={userGambled} userCashedOut={userCashedOut} userData={userData} userMultiplier={userMultiplier} disableButton={disableButton}/>
        <GameContainer
          crashPoint={crashPoint}
          multiplier={multiplier}
          gameStarted={gameStarted}
          gameEnded={gameEnded}
          countDown={countDown}
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
