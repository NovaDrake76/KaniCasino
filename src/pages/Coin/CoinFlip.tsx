import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import SocketConnection from "../../services/socket"
import { setStakeAtRisk } from "../../services/stakeGuard";
import Coin from "./Coin"
import { motion } from "framer-motion";
import UserContext from "../../UserContext";
import LiveBets from "./LiveBets";
import GameButton from "../../components/game/GameButton";
import BetAmount from "../../components/game/BetAmount";
import { getCoinFlipHistory } from "../../services/games/GamesServices";
import { emitGameResult } from "../../components/daisu/tour/tourEvents";
import i18n from "../../i18n";
import { play } from "../../services/sound/sound";

const socket = SocketConnection.getInstance();

// mirrors backend/games/coinFlip.js: a win pays 1.94x, and the minimum exists because
// the payout is whole KP, so below it the rounding would be the house edge. with the purple
// side open the server sends the table instead: a colour pays 2x and purple its own multiplier
const WIN_MULTIPLIER = 1.94;
const MIN_BET = 10;
const MAX_BET = 1000000;
const SIDES = ["heads", "tails", "purple"] as const;
const EMPTY_SIDE = () => ({ players: {}, bets: {}, choices: {} });
const emptyState = () => ({ heads: EMPTY_SIDE(), tails: EMPTY_SIDE(), purple: EMPTY_SIDE() });

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
  const [gameState, setGameState] = useState<any>(emptyState());
  const { isLogged, userData, toogleUserFlow } = useContext(UserContext);
  const purpleOn = !!gameState?.purpleOn;
  const pays = gameState?.pays || { side: WIN_MULTIPLIER };
  const multiplierOf = (side: number | null) => (side === 2 ? pays.purple || 0 : pays.side || WIN_MULTIPLIER);

  // seed the history from past rounds so the page is not blank on entry. the endpoint
  // returns newest first, so it is reversed into the oldest-first order the row appends to.
  useEffect(() => {
    getCoinFlipHistory()
      .then((rounds: Array<{ result: number }>) => {
        setHistory(rounds.map((r) => ({ result: r.result })).reverse());
      })
      .catch(() => {
        // best-effort: a missing history must never break the page
      });
  }, []);

  // the stake and side the round was entered with; the side buttons stay live while it flips
  const placedRef = useRef<{ wagered: number; side: number | null } | null>(null);

  const handleBet = () => {
    if (!isLogged) {
      toogleUserFlow(true);
      return;
    }

    setUserGambled(true);
    setBetAux(bet);
    placedRef.current = { wagered: bet, side: choice };
    play("game.bet");

    // the server has the final word: a refused bet used to leave the ui claiming
    // the player was in the round
    socket.emit("coinFlip:bet", bet, choice, (result: { ok?: boolean; error?: string }) => {
      if (result?.error) {
        setUserGambled(false);
        placedRef.current = null;
        toast.error(result.error);
      }
    });
  };

  useEffect(() => {
    const startListener = () => {
      setResult(null);
      play("coin.flip");
      setSpinning(true); // Start spinning when the game starts
      setCountDown(0); // Reset the countdown
      setGameEnded(false); // The game has started
    };

    const resultListener = (result: number) => {
      setResult(result);
      setSpinning(false);
      play("coin.land");
      if (placedRef.current) {
        const { wagered, side } = placedRef.current;
        play(result === side ? "game.win" : "game.lose");
        emitGameResult({ game: "coinflip", wagered, payout: result === side ? Math.floor(wagered * multiplierOf(side)) : 0 });
        placedRef.current = null;
      }

      //wait 1 second before adding the result to the history
      setTimeout(() => {
        setHistory((prevHistory) => [...prevHistory, { result }]);
        setGameEnded(true);
        setCountDown(11.4);
        setGameState((prev: any) => ({ ...emptyState(), purpleOn: prev?.purpleOn, pays: prev?.pays, version: prev?.version }));
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
    setStakeAtRisk(userGambled || spinning);
  }, [userGambled, spinning]);

  useEffect(() => () => setStakeAtRisk(false), []);

  useEffect(() => {
    if (countDown > 0.1 && !spinning) {
      setTimeout(() => {
        setCountDown(countDown - 0.1);
      }, 100);
    }
  }, [countDown]);

  return (
    <div className="w-full flex flex-col items-center justify-center gap-12">
      <div className="flex w-full max-w-[800px] bg-[#212031] rounded flex-col xl:w-[1140px] xl:max-w-none xl:flex-row">
        <div className="w-full min-w-0 xl:w-[340px] xl:shrink-0 flex flex-col items-center gap-4 border-b xl:border-b-0 xl:border-r border-gray-700 py-4 px-6">
          <div className="w-full">
            <BetAmount
              value={bet === 0 ? "" : String(bet)}
              onChange={(value) => setBet(value === "" ? 0 : Math.min(MAX_BET, Number(value)))}
              onHalve={() => setBet(Math.max(MIN_BET, Math.floor(bet / 2)))}
              onDouble={() => setBet(Math.min(MAX_BET, (bet || MIN_BET) * 2))}
              betValue={bet}
            />
          </div>
          <div className="flex flex-col gap-2 w-full">
            <label className="text-lg font-semibold">{i18n.t("coin.chooseASide")}</label>
            <div className="flex items-center justify-between gap-2 w-full flex-col lg:flex-row">
              {
                [{
                  name: i18n.t("coin.heads"),
                  className: "bg-red-500",
                  id: 0
                }, {
                  name: i18n.t("coin.tails"),
                  className: "bg-green-500",
                  id: 1
                }
                ].map((e) => (
                  <button
                    key={e.id}
                    onClick={() => setChoice(e.id)}
                    className={`p-2 border rounded w-1/2 ${e.className} ${choice === e.id && "bg-opacity-30"}`}
                  >
                    {e.name}
                  </button>
                ))
              }
            </div>
            {purpleOn && (
              <button
                onClick={() => setChoice(2)}
                className={`relative flex w-full items-center justify-between rounded border border-violet-400/60 bg-violet-600 p-2 ${choice === 2 ? "bg-opacity-30" : ""}`}
              >
                <span>{i18n.t("coin.purple")}</span>
                <span className="rounded bg-black/30 px-2 py-0.5 text-xs font-bold text-violet-100">{pays.purple}x</span>
              </button>
            )}
          </div>
          <div className="w-full mt-4">
            <GameButton
              tour="play-button"
              onClick={handleBet}
              disabled={
                choice === null || bet < MIN_BET || userGambled || (userData !== null && userData.walletBalance < bet) || spinning || bet > MAX_BET
              }
            >
              {
                spinning ? "Spinning..."
                  : choice === null ? i18n.t("coin.chooseASide")
                    : bet === 0 ? i18n.t("coin.placeTheBetValue")
                      : bet < MIN_BET ? i18n.t("coin.minBet", { amount: MIN_BET })
                        : bet > MAX_BET ? i18n.t("coin.maxBetIs1m")
                          : userGambled ? "You're in!"
                            : userData !== null && userData.walletBalance < bet ? i18n.t("coin.notEnoughMoney")
                              : i18n.t("coin.enterTheGame")
              }
            </GameButton>
          </div>
          {/* the payout is not 2x, so it says so rather than leaving it to be inferred */}
          <div className="flex w-full flex-col gap-1 text-xs text-[#84819a] pt-2">
            <div className="flex justify-between gap-3">
              <span>{purpleOn ? i18n.t("coin.sidesPay", { mult: pays.side }) : i18n.t("coin.winPays", { mult: WIN_MULTIPLIER })}</span>
              {bet >= MIN_BET && bet <= MAX_BET && (
                <span>{i18n.t("coin.youWouldWin", { amount: Math.floor(bet * multiplierOf(choice)).toLocaleString() })}</span>
              )}
            </div>
            {purpleOn && (
              <span className="text-violet-300">
                {i18n.t("coin.purplePays", { mult: pays.purple, chance: Math.round((pays.purpleChance || 0) * 100) })}
              </span>
            )}
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-col xl:w-[800px] xl:shrink-0">
          <div className="flex w-full border-b border-gray-700 p-4">
            <div className="flex bg-[#19172D] rounded items-center justify-center w-full h-[340px] relative ">
              {
                gameEnded && <div className="absolute top-0 left-0 p-2">
                  <span>
                    Next game in: {countDown.toFixed(1)}
                  </span>
                </div>
              }
              <Coin spinning={spinning} result={result} purple={purpleOn} />
            </div>
          </div>
          <div className="flex w-full p-4 flex-col">
            <h3 className="mb-2 text-lg font-semibold">{i18n.t("coin.gameHistory")}</h3>
            <div className="flex items-center gap-2 justify-end w-full  overflow-hidden h-[24px]">
              {history.map((e, i) => (
                <motion.div
                  key={i}
                  className={`min-w-[24px] min-h-[24px] rounded-full ${e.result === 0 ? "bg-red-500" : e.result === 2 ? "bg-violet-600" : "bg-green-500"}`}
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
          SIDES.slice(0, purpleOn ? 3 : 2).map((side) => (
            <LiveBets gameState={gameState} type={side} key={side} />
          ))
        }
      </div>

    </div >
  );
};

export default CoinFlip;
