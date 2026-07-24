import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import {
  cashoutMines,
  getActiveMinesGame,
  revealMines,
  startMines,
} from "../../services/games/GamesServices";
import { MAX_BET, MIN_BET, MIN_MINES, TILES, gemsFor, payoutFor } from "./minesGrid";
import { MinesGameState } from "./Mines.types";

const DEFAULT_BET = 10;
const DEFAULT_MINES = 3;
const HISTORY_SIZE = 10;
const AUTO_STEP_MS = 320; // paced so an auto run reads as a sequence of picks
export const AUTO_COUNTS = [10, 25, 50, 100];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const useMinesServices = () => {
  const { userData, toogleUserFlow } = useContext(UserContext);
  const navigate = useNavigate();

  const [betInput, setBetInput] = useState<string>(String(DEFAULT_BET));
  const [mineCount, setMineCount] = useState<number>(DEFAULT_MINES);
  const [game, setGame] = useState<MinesGameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ key: string; won: boolean; multiplier: number; payout: number; rollId: string | null }[]>([]);
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [autoCount, setAutoCount] = useState<number>(AUTO_COUNTS[0]);
  const [autoPicks, setAutoPicks] = useState<number>(3);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);

  const seq = useRef(0);
  const gameRef = useRef<MinesGameState | null>(null);
  gameRef.current = game;
  const autoStop = useRef(false);

  const betValue = Math.min(Math.max(Math.floor(Number(betInput)) || MIN_BET, MIN_BET), MAX_BET);
  const active = game?.status === "active";
  const gems = game?.gems ?? 0;
  const currentPayout = active && gems > 0 ? payoutFor(betValue, mineCount, gems) : 0;

  // resume an in-progress game so a reload does not strand a live bet
  useEffect(() => {
    if (userData == null) return;
    getActiveMinesGame()
      .then((res) => {
        if (res?.game) {
          setGame(res.game);
          setMineCount(res.game.mineCount);
          setBetInput(String(res.game.betAmount));
        }
      })
      .catch(() => setGame(null));
  }, [userData]);

  const recordEnd = (g: MinesGameState) => {
    seq.current += 1;
    setHistory((h) =>
      [{ key: `m${seq.current}`, won: g.status === "cashed", multiplier: g.multiplier, payout: g.payout, rollId: g.rollId }, ...h].slice(0, HISTORY_SIZE)
    );
  };

  const start = async (): Promise<MinesGameState | null> => {
    if (userData == null) {
      toogleUserFlow(true);
      return null;
    }
    if (userData.walletBalance < betValue) {
      toast.error("Insufficient funds", { theme: "dark" });
      return null;
    }
    setBusy(true);
    try {
      const g: MinesGameState = await startMines(betValue, mineCount);
      setGame(g);
      return g;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not start the game", { theme: "dark" });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const reveal = async (tile: number): Promise<MinesGameState | null> => {
    const g = gameRef.current;
    if (!g || g.status !== "active" || g.revealed.includes(tile) || busy) return null;
    setBusy(true);
    try {
      const next: MinesGameState = await revealMines(tile);
      setGame(next);
      if (next.status !== "active") recordEnd(next);
      return next;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not reveal the tile", { theme: "dark" });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const cashout = async (): Promise<MinesGameState | null> => {
    const g = gameRef.current;
    if (!g || g.status !== "active" || g.gems === 0 || busy) return null;
    setBusy(true);
    try {
      const next: MinesGameState = await cashoutMines();
      setGame(next);
      recordEnd(next);
      return next;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not cash out", { theme: "dark" });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const randomTile = () => {
    const g = gameRef.current;
    if (!g || g.status !== "active") return;
    const covered = [];
    for (let t = 0; t < TILES; t++) if (!g.revealed.includes(t)) covered.push(t);
    if (!covered.length) return;
    const pick = covered[Math.floor(Math.random() * covered.length)];
    reveal(pick);
  };

  const stopAuto = () => {
    autoStop.current = true;
    setAutoRunning(false);
    setAutoLeft(0);
  };

  // simple auto: each round reveals `autoPicks` random tiles, cashing out if it survives
  // them and moving on if it busts. sequential so the board animates one pick at a time.
  const startAuto = async () => {
    if (autoRunning) return;
    if (userData == null) {
      toogleUserFlow(true);
      return;
    }
    autoStop.current = false;
    setAutoRunning(true);
    let left = autoCount;
    setAutoLeft(left);
    while (left > 0 && !autoStop.current) {
      const started = await start();
      if (!started) break;
      await wait(AUTO_STEP_MS);
      let g: MinesGameState | null = started;
      let picks = 0;
      const target = Math.min(autoPicks, gemsFor(mineCount));
      while (g && g.status === "active" && picks < target && !autoStop.current) {
        const covered = [];
        for (let t = 0; t < TILES; t++) if (!g.revealed.includes(t)) covered.push(t);
        g = await reveal(covered[Math.floor(Math.random() * covered.length)]);
        picks += 1;
        await wait(AUTO_STEP_MS);
      }
      if (g && g.status === "active" && !autoStop.current) {
        await cashout();
        await wait(AUTO_STEP_MS);
      }
      left -= 1;
      setAutoLeft(left);
    }
    setAutoRunning(false);
    setAutoLeft(0);
  };

  useEffect(() => () => { autoStop.current = true; }, []);

  const changeMineCount = (n: number) => {
    if (active) return;
    setMineCount(Math.min(Math.max(Math.floor(n) || MIN_MINES, MIN_MINES), TILES - 1));
  };

  return {
    isLogged: userData != null,
    walletBalance: userData?.walletBalance ?? 0,
    betInput,
    betValue,
    setBetInput,
    normalizeBet: () => setBetInput(String(betValue)),
    halveBet: () => setBetInput(String(Math.max(MIN_BET, Math.floor(betValue / 2)))),
    doubleBet: () => setBetInput(String(Math.min(MAX_BET, betValue * 2))),
    mineCount,
    changeMineCount,
    gemsCount: gemsFor(mineCount),
    game,
    active,
    busy,
    gems,
    currentPayout,
    history,
    mode,
    setMode,
    autoCount,
    setAutoCount,
    autoPicks,
    setAutoPicks,
    autoRunning,
    autoLeft,
    startAuto,
    stopAuto,
    start,
    reveal,
    cashout,
    randomTile,
    openRoll: (rollId: string) => navigate(`/provably-fair?roll=${rollId}`),
  };
};
