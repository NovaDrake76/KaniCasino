import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import {
  cashoutHilo,
  getActiveHiloGame,
  guessHilo,
  skipHilo,
  startHilo,
} from "../../services/games/GamesServices";
import { MAX_BET, MIN_BET } from "./hiloCards";
import { HiloGameState } from "./Hilo.types";
import i18n from "../../i18n";
import { useSessionStats } from "../../stats/SessionStatsContext";
import { play } from "../../services/sound/sound";

const DEFAULT_BET = 10;
const HISTORY_SIZE = 10;

export const useHiloServices = () => {
  const { userData, toogleUserFlow } = useContext(UserContext);
  const { track } = useSessionStats();
  const navigate = useNavigate();

  const [betInput, setBetInput] = useState<string>(String(DEFAULT_BET));
  const [game, setGame] = useState<HiloGameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ key: string; won: boolean; multiplier: number; payout: number; rollId: string | null }[]>([]);

  const seq = useRef(0);
  const gameRef = useRef<HiloGameState | null>(null);
  gameRef.current = game;

  const betValue = Math.min(Math.max(Math.floor(Number(betInput)) || MIN_BET, MIN_BET), MAX_BET);
  const active = game?.status === "active";

  useEffect(() => {
    if (userData == null) return;
    getActiveHiloGame()
      .then((res) => {
        if (res?.game) {
          setGame(res.game);
          setBetInput(String(res.game.betAmount));
        }
      })
      .catch(() => setGame(null));
  }, [userData]);

  const recordEnd = (g: HiloGameState) => {
    track({ game: "hilo", wagered: g.betAmount, payout: g.payout || 0 });
    seq.current += 1;
    setHistory((h) =>
      [{ key: `h${seq.current}`, won: g.status === "cashed", multiplier: g.multiplier, payout: g.payout, rollId: g.rollId }, ...h].slice(0, HISTORY_SIZE)
    );
  };

  const run = async (fn: () => Promise<HiloGameState>, guard = true, after?: (next: HiloGameState) => void): Promise<void> => {
    if (guard && busy) return;
    setBusy(true);
    try {
      const next = await fn();
      setGame(next);
      after?.(next);
      if (next.status !== "active" && next.status !== "voided") recordEnd(next);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Something went wrong", { theme: "dark" });
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    if (userData == null) return toogleUserFlow(true);
    if (userData.walletBalance < betValue) return toast.error(i18n.t("blackjack.insufficientFunds"), { theme: "dark" });
    play("game.bet");
    run(() => startHilo(betValue), true, () => play("cards.deal"));
  };
  const guess = (direction: "hi" | "lo") => {
    if (!gameRef.current || gameRef.current.status !== "active") return;
    run(() => guessHilo(direction), true, (next) => {
      play("cards.flip");
      if (next.status === "active") play("hilo.correct");
      else if (next.status === "busted") {
        play("hilo.wrong");
        play("game.lose");
      } else if (next.status === "cashed") {
        play("game.cashout");
        play("game.win");
      }
    });
  };
  const skip = () => {
    const g = gameRef.current;
    if (!g || g.status !== "active" || !g.canSkip) return;
    run(() => skipHilo(), true, () => play("cards.deal"));
  };
  const cashout = () => {
    const g = gameRef.current;
    if (!g || g.status !== "active" || !g.canCashout) return;
    run(() => cashoutHilo(), true, () => {
      play("game.cashout");
      play("game.win");
    });
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
    game,
    active,
    busy,
    history,
    start,
    guess,
    skip,
    cashout,
    openRoll: (rollId: string) => navigate(`/provably-fair?roll=${rollId}`),
  };
};
