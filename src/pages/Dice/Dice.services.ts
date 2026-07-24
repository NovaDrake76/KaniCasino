import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import { rollDice } from "../../services/games/GamesServices";
import {
  Direction,
  MAX_BET,
  MIN_BET,
  OUTCOMES,
  clampTarget,
  controlsFor,
  targetForMultiplier,
  targetForWinChance,
} from "./diceControls";
import { DiceHistoryEntry, DiceRollResult } from "./Dice.types";

const DEFAULT_BET = 10;
const DEFAULT_TARGET = 5050; // over 50.50 -> 2.0000x, the classic starting point
const HISTORY_SIZE = 12;
const AUTO_INTERVAL_MS = 550; // paced so an auto run reads as a sequence, not a burst
export const AUTO_COUNTS = [10, 25, 50, 100];

export const useDiceServices = () => {
  const { userData, toogleUserFlow } = useContext(UserContext);
  const navigate = useNavigate();

  const [betInput, setBetInput] = useState<string>(String(DEFAULT_BET));
  const [target, setTarget] = useState<number>(DEFAULT_TARGET);
  const [direction, setDirection] = useState<Direction>("over");
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [autoCount, setAutoCount] = useState<number>(AUTO_COUNTS[0]);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [last, setLast] = useState<DiceRollResult | null>(null);
  const [history, setHistory] = useState<DiceHistoryEntry[]>([]);

  const rollSeq = useRef(0);
  const autoLeftRef = useRef(0);
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dragging, setDragging] = useState(false);

  const controls = controlsFor(target, direction);
  const betValue = Math.min(Math.max(Math.floor(Number(betInput)) || MIN_BET, MIN_BET), MAX_BET);
  const profitOnWin = controls.payoutOnWin(betValue) - betValue;

  // the slider and the three number fields all drive the same target
  const changeTarget = (next: number) => setTarget(clampTarget(next, direction));

  // dragging the handle on the bar: map the pointer x within the track to a target.
  // pointer capture (set on pointerdown) keeps the events coming even off the element,
  // so getBoundingClientRect on the currentTarget stays the track the whole drag.
  const targetFromPointer = (clientX: number, rect: DOMRect) => {
    const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    return clampTarget(Math.round(pct * OUTCOMES), direction);
  };
  const trackHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (autoRunning) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      setTarget(targetFromPointer(e.clientX, e.currentTarget.getBoundingClientRect()));
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!dragging) return;
      setTarget(targetFromPointer(e.clientX, e.currentTarget.getBoundingClientRect()));
    },
    onPointerUp: (e: React.PointerEvent) => {
      setDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // capture may already be gone; nothing to release
      }
    },
  };
  const changeWinChance = (chance: number) => {
    if (Number.isFinite(chance)) setTarget(targetForWinChance(chance, direction));
  };
  const changeMultiplier = (mult: number) => {
    if (Number.isFinite(mult) && mult > 0) setTarget(targetForMultiplier(mult, direction));
  };
  // flipping direction keeps the same win chance by mirroring the target
  const toggleDirection = () => {
    const nextDir: Direction = direction === "over" ? "under" : "over";
    setTarget(targetForWinChance(controls.winChance, nextDir));
    setDirection(nextDir);
  };

  const fireRoll = async (): Promise<boolean> => {
    if (userData == null) {
      toogleUserFlow(true);
      return false;
    }
    if (userData.walletBalance < betValue) {
      toast.error("Insufficient funds", { theme: "dark" });
      return false;
    }
    setRolling(true);
    try {
      const result: DiceRollResult = await rollDice(betValue, target, direction);
      rollSeq.current += 1;
      setLast(result);
      setHistory((h) =>
        [
          {
            key: `d${rollSeq.current}`,
            resultValue: result.resultValue,
            won: result.won,
            multiplier: result.multiplier,
            rollId: result.rollId,
          },
          ...h,
        ].slice(0, HISTORY_SIZE)
      );
      return true;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not roll", { theme: "dark" });
      return false;
    } finally {
      setRolling(false);
    }
  };

  // the auto interval reads through a ref so it always sees the current bet and target
  const fireRollRef = useRef(fireRoll);
  fireRollRef.current = fireRoll;

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
      if (autoLeftRef.current <= 0) return stopAuto();
      autoLeftRef.current -= 1;
      setAutoLeft(autoLeftRef.current);
      const ok = await fireRollRef.current();
      if (!ok || autoLeftRef.current <= 0) stopAuto();
    };
    tick();
    autoTimer.current = setInterval(tick, AUTO_INTERVAL_MS);
  };

  useEffect(() => () => stopAuto(), [stopAuto]);

  return {
    isLogged: userData != null,
    walletBalance: userData?.walletBalance ?? 0,
    betInput,
    betValue,
    setBetInput,
    normalizeBet: () => setBetInput(String(betValue)),
    halveBet: () => setBetInput(String(Math.max(MIN_BET, Math.floor(betValue / 2)))),
    doubleBet: () => setBetInput(String(Math.min(MAX_BET, betValue * 2))),
    target,
    direction,
    controls,
    profitOnWin,
    changeTarget,
    changeWinChance,
    changeMultiplier,
    toggleDirection,
    dragging,
    trackHandlers,
    mode,
    setMode,
    autoCount,
    setAutoCount,
    autoRunning,
    autoLeft,
    startAuto,
    stopAuto,
    rolling,
    roll: fireRoll,
    last,
    history,
    openRoll: (rollId: string) => navigate(`/provably-fair?roll=${rollId}`),
  };
};
