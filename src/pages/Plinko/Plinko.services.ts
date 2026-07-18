import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import { dropPlinko } from "../../services/games/GamesServices";
import { MAX_BET, PlinkoRisk } from "./plinkoBoard";
import { PlinkoBall, PlinkoDropResult } from "./Plinko.types";

const DEFAULT_BET = 10;
const HISTORY_SIZE = 8;
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
  const [dropping, setDropping] = useState(false);
  const [balls, setBalls] = useState<PlinkoBall[]>([]);
  const [history, setHistory] = useState<PlinkoBall[]>([]);
  const [lastHit, setLastHit] = useState<{ bin: number; seq: number } | null>(null);
  const [pegPulses, setPegPulses] = useState<Record<string, number>>({});

  const ballSeq = useRef(0);
  const hitSeq = useRef(0);
  const pulseSeq = useRef(0);
  const settled = useRef<Set<string>>(new Set());
  const autoLeftRef = useRef(0);
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxBet = MAX_BET[risk];
  const betValue = Math.min(Math.max(Math.floor(Number(betInput)) || 1, 1), maxBet);

  const fireDrop = async (): Promise<boolean> => {
    if (userData == null) {
      toogleUserFlow(true);
      return false;
    }
    if (userData.walletBalance < betValue) {
      toast.error("Insufficient funds", { theme: "dark" });
      return false;
    }
    try {
      const result: PlinkoDropResult = await dropPlinko(betValue, risk);
      ballSeq.current += 1;
      setBalls((prev) => [...prev, { ...result, key: `b${ballSeq.current}` }]);
      return true;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not drop the ball", { theme: "dark" });
      return false;
    }
  };

  // the auto interval reads through a ref so it always sees the current bet and risk
  const fireDropRef = useRef(fireDrop);
  fireDropRef.current = fireDrop;

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
      if (autoLeftRef.current <= 0) {
        stopAuto();
        return;
      }
      autoLeftRef.current -= 1;
      setAutoLeft(autoLeftRef.current);
      const ok = await fireDropRef.current();
      if (!ok) stopAuto();
      else if (autoLeftRef.current <= 0) stopAuto();
    };
    tick();
    autoTimer.current = setInterval(tick, AUTO_DROP_INTERVAL_MS);
  };

  useEffect(() => () => stopAuto(), [stopAuto]);

  const drop = async () => {
    if (dropping) return;
    setDropping(true);
    await fireDrop();
    setDropping(false);
  };

  // a fresh sequence per strike remounts the peg's pulse animation
  const pulsePeg = useCallback((row: number, index: number) => {
    pulseSeq.current += 1;
    const seq = pulseSeq.current;
    setPegPulses((prev) => ({ ...prev, [`${row}-${index}`]: seq }));
  }, []);

  // guarded by key so a duplicate animation-complete cannot double-record a ball
  const settleBall = useCallback((ball: PlinkoBall) => {
    if (settled.current.has(ball.key)) return;
    settled.current.add(ball.key);
    hitSeq.current += 1;
    setBalls((prev) => prev.filter((b) => b.key !== ball.key));
    setLastHit({ bin: ball.bin, seq: hitSeq.current });
    setHistory((h) => [ball, ...h].slice(0, HISTORY_SIZE));
  }, []);

  const canChangeRisk = balls.length === 0 && !autoRunning;
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
    dropping,
    balls,
    history,
    lastHit,
    pegPulses,
    pulsePeg,
    settleBall,
    openRoll: (rollId: string) => navigate(`/provably-fair?roll=${rollId}`),
  };
};
