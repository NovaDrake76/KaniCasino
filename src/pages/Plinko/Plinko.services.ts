import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import { dropPlinko } from "../../services/games/GamesServices";
import { DROP_DURATION_S, MAX_BET, PlinkoRisk } from "./plinkoBoard";
import { DropOutcome, autoStep, outcomeFor } from "./autoRun";
import { PlinkoBall, PlinkoDropResult } from "./Plinko.types";
import i18n from "../../i18n";

const DEFAULT_BET = 10;
const HISTORY_SIZE = 8;
// hard cap on concurrent balls (pending requests + falling); the server allows more
const MAX_IN_FLIGHT = 12;
// paced so an auto run reads as a stream of balls instead of one burst
const AUTO_DROP_INTERVAL_MS = 400;
export const AUTO_COUNTS = [10, 25, 50, 100];

export const usePlinkoServices = () => {
  const { userData, toogleUserFlow } = useContext(UserContext);
  const navigate = useNavigate();

  const [betInput, setBetInput] = useState<string>(String(DEFAULT_BET));
  const [risk, setRisk] = useState<PlinkoRisk>("medium");
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [autoCount, setAutoCount] = useState<number>(AUTO_COUNTS[0]);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [pendingDrops, setPendingDrops] = useState(0);
  const [balls, setBalls] = useState<PlinkoBall[]>([]);
  const [history, setHistory] = useState<PlinkoBall[]>([]);
  const [lastHit, setLastHit] = useState<{ bin: number; seq: number } | null>(null);

  const ballSeq = useRef(0);
  const hitSeq = useRef(0);
  const pendingStake = useRef(0);
  const settled = useRef<Set<string>>(new Set());
  const autoLeftRef = useRef(0);
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxBet = MAX_BET[risk];
  const betValue = Math.min(Math.max(Math.floor(Number(betInput)) || 1, 1), maxBet);

  // the wallet only refreshes when a ball lands, so count the stakes still in the air
  const available = () => (userData?.walletBalance ?? 0) - pendingStake.current;
  const releaseStake = (stake: number) => {
    pendingStake.current = Math.max(0, pendingStake.current - stake);
  };

  const fireDrop = async (): Promise<DropOutcome> => {
    if (userData == null) {
      toogleUserFlow(true);
      return "stop";
    }
    if (available() < betValue) {
      toast.error(i18n.t("blackjack.insufficientFunds"), { theme: "dark" });
      return "stop";
    }
    const stake = betValue;
    pendingStake.current += stake;
    setPendingDrops((n) => n + 1);
    try {
      const result: PlinkoDropResult = await dropPlinko(stake, risk);
      ballSeq.current += 1;
      setBalls((prev) => [...prev, { ...result, key: `b${ballSeq.current}` }]);
      // released on a clock rather than when the ball lands: the server sends the new
      // balance on its own schedule, and a dropped frame must not strand a stake and
      // lock a player out of money they still have
      window.setTimeout(() => releaseStake(stake), DROP_DURATION_S * 1000);
      return "ok";
    } catch (error: any) {
      releaseStake(stake);
      const outcome = outcomeFor(error?.response?.status);
      // a retryable refusal is the server being busy, so it is not worth a toast every
      // time; the run simply tries that ball again
      if (outcome === "stop") {
        toast.error(error?.response?.data?.message || "Could not drop the ball", { theme: "dark" });
      }
      return outcome;
    } finally {
      setPendingDrops((n) => n - 1);
    }
  };

  // the auto interval reads through refs so it always sees the current bet, risk and board
  const fireDropRef = useRef(fireDrop);
  fireDropRef.current = fireDrop;
  const stepRef = useRef(() => autoStep({ left: 0, inFlight: 0, available: 0, bet: 1, maxInFlight: MAX_IN_FLIGHT }));
  stepRef.current = () =>
    autoStep({
      left: autoLeftRef.current,
      inFlight: balls.length + pendingDrops,
      available: available(),
      bet: betValue,
      maxInFlight: MAX_IN_FLIGHT,
    });

  const stopAuto = useCallback(() => {
    if (autoTimer.current) clearInterval(autoTimer.current);
    autoTimer.current = null;
    autoLeftRef.current = 0;
    setAutoLeft(0);
    setAutoRunning(false);
  }, []);

  const startAuto = () => {
    if (autoRunning) return;
    if (userData == null) {
      toogleUserFlow(true);
      return;
    }
    setAutoRunning(true);
    autoLeftRef.current = autoCount;
    setAutoLeft(autoCount);
    const tick = async () => {
      const step = stepRef.current();
      if (step === "done") return stopAuto();
      if (step === "broke") {
        toast.error(i18n.t("blackjack.insufficientFunds"), { theme: "dark" });
        return stopAuto();
      }
      // a full board or a shortfall a falling ball may still cover costs a tick, never a
      // ball: the run picks up again on the next one instead of ending half finished
      if (step === "wait") return;
      autoLeftRef.current -= 1;
      setAutoLeft(autoLeftRef.current);
      const outcome = await fireDropRef.current();
      if (outcome === "retry") {
        // hand the ball back: the server refused for something that clears on its own,
        // so the run still finishes every ball it was asked for
        autoLeftRef.current += 1;
        setAutoLeft(autoLeftRef.current);
        return;
      }
      if (outcome === "stop") return stopAuto();
      if (autoLeftRef.current <= 0) stopAuto();
    };
    tick();
    autoTimer.current = setInterval(tick, AUTO_DROP_INTERVAL_MS);
  };

  useEffect(() => () => stopAuto(), [stopAuto]);

  // drops fire without waiting for the previous one, capped by balls already in play
  const canDrop = balls.length + pendingDrops < MAX_IN_FLIGHT;
  const drop = () => {
    if (!canDrop) return;
    fireDrop();
  };


  // guarded by key so a duplicate animation-complete cannot double-record a ball
  const settleBall = useCallback((ball: PlinkoBall) => {
    if (settled.current.has(ball.key)) return;
    settled.current.add(ball.key);
    hitSeq.current += 1;
    setBalls((prev) => prev.filter((b) => b.key !== ball.key));
    setLastHit({ bin: ball.bin, seq: hitSeq.current });
    setHistory((h) => [ball, ...h].slice(0, HISTORY_SIZE));
  }, []);

  const canChangeRisk = balls.length === 0 && pendingDrops === 0 && !autoRunning;
  const changeRisk = (next: PlinkoRisk) => {
    if (!canChangeRisk) return;
    setRisk(next);
    setBetInput((prev) => String(Math.min(Math.max(Math.floor(Number(prev)) || 1, 1), MAX_BET[next])));
  };

  const normalizeBet = () => setBetInput(String(betValue));

  return {
    isLogged: userData != null,
    walletBalance: userData?.walletBalance ?? 0,
    betInput,
    betValue,
    maxBet,
    setBetInput,
    normalizeBet,
    halveBet: () => setBetInput(String(Math.max(1, Math.floor(betValue / 2)))),
    doubleBet: () => setBetInput(String(Math.min(maxBet, betValue * 2))),
    maxOutBet: () =>
      setBetInput(String(Math.min(maxBet, Math.max(1, Math.floor(userData?.walletBalance ?? maxBet))))),
    risk,
    canChangeRisk,
    changeRisk,
    mode,
    setMode,
    autoCount,
    setAutoCount,
    autoRunning,
    autoLeft,
    startAuto,
    stopAuto,
    drop,
    canDrop,
    pendingDrops,
    balls,
    history,
    lastHit,
    settleBall,
    openRoll: (rollId: string) => navigate(`/provably-fair?roll=${rollId}`),
  };
};
