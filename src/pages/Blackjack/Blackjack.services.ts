import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import {
  dealBlackjack,
  doubleBlackjack,
  getActiveBlackjackHand,
  hitBlackjack,
  insureBlackjack,
  splitBlackjack,
  standBlackjack,
} from "../../services/games/GamesServices";
import { BlackjackHandState, BlackjackHistoryEntry, BlackjackPhase } from "./Blackjack.types";

const DEFAULT_BET = 10;
export const MIN_BET = 1;
export const MAX_BET = 100000;
const HISTORY_SIZE = 8;
// reveal pacing: hole flip, then each dealer draw, then the result banner
const HOLE_FLIP_MS = 450;
const DEALER_DRAW_MS = 600;
const RESULT_MS = 500;

export const useBlackjackServices = () => {
  const { userData, toogleUserFlow } = useContext(UserContext);
  const navigate = useNavigate();

  const [betInput, setBetInput] = useState<string>(String(DEFAULT_BET));
  const [phase, setPhase] = useState<BlackjackPhase>("idle");
  const [hand, setHand] = useState<BlackjackHandState | null>(null);
  const [acting, setActing] = useState(false);
  const [revealStep, setRevealStep] = useState(1);
  const [instant, setInstant] = useState(false);
  const [history, setHistory] = useState<BlackjackHistoryEntry[]>([]);
  const [lastBet, setLastBet] = useState<number>(DEFAULT_BET);

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const instantRef = useRef(instant);
  instantRef.current = instant;

  const betValue = Math.min(Math.max(Math.floor(Number(betInput)) || MIN_BET, MIN_BET), MAX_BET);

  const clearRevealTimer = () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = null;
  };

  const pushHistory = (settled: BlackjackHandState) => {
    setHistory((h) =>
      [
        {
          handId: settled.handId,
          rollId: settled.rollId,
          outcome: settled.hands[0].outcome,
          payout: settled.totalPayout,
          betAmount: settled.betAmount,
        },
        ...h,
      ].slice(0, HISTORY_SIZE)
    );
  };

  // pace the dealer reveal: the server already returned every card, the client
  // only controls how fast they are disclosed
  const startReveal = useCallback((settled: BlackjackHandState) => {
    clearRevealTimer();
    setHand(settled);
    const total = settled.dealer.cards.length;
    if (instantRef.current) {
      setRevealStep(total);
      setPhase("settled");
      pushHistory(settled);
      return;
    }
    setPhase("revealing");
    setRevealStep(1);
    let step = 1;
    const advance = () => {
      step += 1;
      setRevealStep(step);
      if (step < total) {
        revealTimer.current = setTimeout(advance, DEALER_DRAW_MS);
      } else {
        revealTimer.current = setTimeout(() => {
          setPhase("settled");
          pushHistory(settled);
        }, RESULT_MS);
      }
    };
    revealTimer.current = setTimeout(advance, HOLE_FLIP_MS);
  }, []);

  const applyResponse = useCallback(
    (res: BlackjackHandState) => {
      if (res.status === "settled") startReveal(res);
      else {
        setHand(res);
        setPhase("player");
        setRevealStep(1);
      }
    },
    [startReveal]
  );

  // resume a hand the player left (or another tab dealt); also the 409 resync path
  const refresh = useCallback(async () => {
    try {
      const data = await getActiveBlackjackHand();
      if (data.hand) applyResponse(data.hand);
      else {
        setHand(null);
        setPhase("idle");
      }
    } catch {
      // leave the current state; the next action will resync
    }
  }, [applyResponse]);

  useEffect(() => {
    if (userData != null) refresh();
    return clearRevealTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData != null]);

  const deal = async (amount = betValue) => {
    if (acting || phase === "player" || phase === "revealing") return;
    if (userData == null) {
      toogleUserFlow(true);
      return;
    }
    if (userData.walletBalance < amount) {
      toast.error("Insufficient funds", { theme: "dark" });
      return;
    }
    setActing(true);
    try {
      setLastBet(amount);
      setBetInput(String(amount));
      const res = await dealBlackjack(amount);
      applyResponse(res);
    } catch (error: any) {
      if (error?.response?.status === 409) await refresh();
      else toast.error(error?.response?.data?.message || "Could not deal", { theme: "dark" });
    } finally {
      setActing(false);
    }
  };

  const act = async (fn: () => Promise<BlackjackHandState>) => {
    if (acting || phase !== "player") return;
    setActing(true);
    try {
      applyResponse(await fn());
    } catch (error: any) {
      if (error?.response?.status === 409) await refresh();
      else toast.error(error?.response?.data?.message || "Action failed", { theme: "dark" });
    } finally {
      setActing(false);
    }
  };

  const hit = () => act(hitBlackjack);
  const stand = () => act(standBlackjack);
  const double = () => act(doubleBlackjack);
  const split = () => act(splitBlackjack);
  const insure = (accept: boolean) => act(() => insureBlackjack(accept));
  const rebet = (multiplier = 1) =>
    deal(Math.min(MAX_BET, Math.max(MIN_BET, lastBet * multiplier)));

  // keyboard shortcuts: h/s/d/p during play, space to deal or rebet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || acting) return;
      const key = e.key.toLowerCase();
      if (phase === "player") {
        if (key === "h") hit();
        if (key === "s") stand();
        if (key === "d") double();
        if (key === "p") split();
      } else if ((phase === "idle" || phase === "settled") && key === " ") {
        e.preventDefault();
        if (phase === "settled") rebet();
        else deal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const normalizeBet = () => setBetInput(String(betValue));
  // digits only at the input boundary, so letters and symbols never render
  const updateBetInput = (raw: string) => setBetInput(raw.replace(/\D/g, "").slice(0, 6));
  const playerHand = hand?.hands[hand.activeHandIndex] ?? null;
  const walletBalance = userData?.walletBalance ?? 0;

  return {
    isLogged: userData != null,
    walletBalance,
    betInput,
    betValue,
    setBetInput: updateBetInput,
    normalizeBet,
    halveBet: () => setBetInput(String(Math.max(MIN_BET, Math.floor(betValue / 2)))),
    doubleBet: () => setBetInput(String(Math.min(MAX_BET, betValue * 2))),
    maxOutBet: () =>
      setBetInput(String(Math.min(MAX_BET, Math.max(MIN_BET, Math.floor(walletBalance || MIN_BET))))),
    phase,
    hand,
    playerHand,
    acting,
    revealStep,
    instant,
    setInstant,
    history,
    lastBet,
    deal,
    hit,
    stand,
    double,
    split,
    insure,
    rebet,
    canHit: phase === "player" && !!hand?.canHit && !acting,
    canStand: phase === "player" && !!hand?.canStand && !acting,
    canDouble:
      phase === "player" && !!hand?.canDouble && !acting && walletBalance >= (hand?.betAmount ?? 0),
    canSplit:
      phase === "player" && !!hand?.canSplit && !acting && walletBalance >= (hand?.betAmount ?? 0),
    canInsure: phase === "player" && !!hand?.canInsure && !acting,
    awaitingInsurance: phase === "player" && !!hand?.awaitingInsurance,
    insuranceCost: Math.floor((hand?.betAmount ?? 0) / 2),
    openRoll: (rollId: string) => navigate(`/provably-fair?roll=${rollId}`),
  };
};
