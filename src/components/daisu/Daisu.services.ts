import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import { claimPot, getPotStatus, PotStatus } from "../../services/daisu/DaisuService";
import { claimMission, getMissions, Mission } from "../../services/missions/MissionService";
import { useGiftStatus } from "../header/useGiftReady";
import { GAME_NAME_KEYS, GAME_PATHS, clock, fillAt, kp, msUntil, payout } from "./potMath";
import { greetingFor, lineKey, Mood } from "./daisuLines";
import type { Burst, CreditView, Face, Line } from "./Daisu.types";
import i18n from "../../i18n";

const OPEN_KEY = "kani.daisuOpen";
// the bar moves visibly at four frames a second; collapsed it only needs the number
const OPEN_TICK_MS = 250;
const CLOSED_TICK_MS = 1000;
// long enough to read the reaction, short enough that she is not stuck grinning
const FACE_MS = 2600;
// a bet can spend a credit, so the dock re-reads after the wallet moves, but never more
// often than this: dice players bet every second
const WALLET_REFRESH_MS = 3000;
const ASKS = 3;

// the dock starts open on a desktop, which is how a player finds out it exists; on a
// phone the card would cover the games, so it starts as the bubble
const readOpen = () => {
  const wide = window.innerWidth >= 768;
  try {
    const stored = window.localStorage.getItem(OPEN_KEY);
    return stored === null ? wide : stored === "1";
  } catch {
    return wide;
  }
};

const storeOpen = (open: boolean) => {
  try {
    window.localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  } catch {
    // storage blocked: it opens again next visit, which is fine
  }
};

// the missions worth her asking about: a reward to collect first, then whatever is
// closest to done, never one already claimed
export const pickAsks = (missions: Mission[], limit = ASKS): Mission[] =>
  missions
    .filter((m) => !m.claimed)
    .sort((a, b) => {
      if (a.claimable !== b.claimable) return a.claimable ? -1 : 1;
      const pa = a.target > 0 ? a.current / a.target : 0;
      const pb = b.target > 0 ? b.current / b.target : 0;
      return pb - pa;
    })
    .slice(0, limit);

export const useDaisu = () => {
  const { userData, toogleUserData } = useContext(UserContext);
  const enabled = !!userData?.features?.daisu;
  const userId: string | undefined = userData?.id;
  const wallet: number = userData?.walletBalance ?? 0;
  const gift = useGiftStatus();

  const [status, setStatus] = useState<PotStatus | null>(null);
  const [open, setOpen] = useState(readOpen);
  const [now, setNow] = useState(() => Date.now());
  const [line, setLine] = useState<Line | null>(null);
  const [face, setFace] = useState<Face>("idle");
  const [shaking, setShaking] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [claimingMission, setClaimingMission] = useState<string | null>(null);

  const faceTimer = useRef<ReturnType<typeof setTimeout>>();
  const shakeTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastStatusAt = useRef(0);
  const greeted = useRef(false);

  const say = useCallback((mood: Mood, vars?: Line["vars"]) => {
    setLine({ key: lineKey(mood, Math.random()), vars });
  }, []);

  const pull = useCallback((f: Face) => {
    setFace(f);
    if (faceTimer.current) clearTimeout(faceTimer.current);
    faceTimer.current = setTimeout(() => setFace("idle"), FACE_MS);
  }, []);

  const shake = useCallback(() => {
    setShaking(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShaking(false), 500);
  }, []);

  const refresh = useCallback(() => {
    lastStatusAt.current = Date.now();
    getPotStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (!enabled || !userId) {
      setStatus(null);
      greeted.current = false;
      return;
    }
    refresh();
  }, [enabled, userId, refresh]);

  // only a held credit can change between claims, and only a bet spends it
  useEffect(() => {
    if (!enabled || !status) return;
    const holds = Object.values(status.credits).some((n) => (n || 0) > 0);
    if (!holds || Date.now() - lastStatusAt.current < WALLET_REFRESH_MS) return;
    refresh();
    // the wallet is the trigger; status is only read for what it held
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), open ? OPEN_TICK_MS : CLOSED_TICK_MS);
    return () => clearInterval(t);
  }, [enabled, open]);

  const loadMissions = useCallback(() => {
    getMissions()
      .then((d) => setMissions(d.missions))
      .catch(() => setMissions([]));
  }, []);

  useEffect(() => {
    if (!enabled || !open || !userId) return;
    loadMissions();
  }, [enabled, open, userId, loadMissions]);

  useEffect(() => {
    storeOpen(open);
    if (!open) greeted.current = false;
  }, [open]);

  useEffect(
    () => () => {
      if (faceTimer.current) clearTimeout(faceTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    },
    []
  );

  const fill = status ? fillAt(status.fullAt, status.cycleMs, now) : 0;
  const amount = status ? payout(status.full, fill) : 0;
  const floor = status?.floor ?? 0.1;
  const isFull = fill >= 1;
  const hasSomething = !!status && fill >= floor;
  const untilFloor = status ? clock(msUntil(status.fullAt, status.cycleMs, floor, now)) : "";
  const untilFull = status ? clock(msUntil(status.fullAt, status.cycleMs, 1, now)) : "";

  const credits: CreditView[] = status
    ? (Object.entries(status.credits) as [CreditView["game"], number][])
        .filter(([, n]) => (n || 0) > 0)
        .map(([game, n]) => ({ game, amount: n, path: GAME_PATHS[game], name: i18n.t(GAME_NAME_KEYS[game]) }))
    : [];
  const pickName = status ? i18n.t(GAME_NAME_KEYS[status.pick]) : "";
  const pickPath = status ? GAME_PATHS[status.pick] : "/";

  const asks = pickAsks(missions);
  const missionReady = asks.some((m) => m.claimable);
  const attention = isFull || missionReady || gift.canSpin;

  // she speaks once per opening, once there is something to speak about
  useEffect(() => {
    if (!open || !status || greeted.current) return;
    greeted.current = true;
    const mood = greetingFor({ fill, floor, holdsCredit: credits.length > 0, missionReady, wallet });
    const first = credits[0];
    say(mood, {
      amount: kp(amount),
      clock: mood === "broke" ? untilFloor : untilFull,
      credit: kp(first?.amount ?? 0),
      game: first?.name ?? pickName,
    });
    // reads the derived values of the moment it opened; later ticks must not re-greet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, status]);

  const claim = async () => {
    if (!status || claiming) return;
    if (fill < floor) {
      shake();
      pull("surprised");
      say("empty", { clock: untilFloor });
      return;
    }
    setClaiming(true);
    try {
      const res = await claimPot();
      lastStatusAt.current = Date.now();
      setStatus(res.status);
      if (userData) toogleUserData({ ...userData, walletBalance: res.walletBalance, nextBonus: res.nextBonus });
      const game = i18n.t(GAME_NAME_KEYS[res.pick]);
      setBurst({ id: Date.now(), amount: res.amount, credit: res.credit, game });
      pull("happy");
      say(res.credit > 0 ? "claimedCredit" : "claimed", { amount: kp(res.amount), credit: kp(res.credit), game });
    } catch (err: any) {
      const reason = err?.response?.data?.reason;
      if (reason === "empty") {
        shake();
        pull("surprised");
        say("empty", { clock: untilFloor });
      } else if (reason === "raced") {
        refresh();
      } else {
        toast.error(err?.response?.data?.message || i18n.t("daisu.couldNotClaim"), { theme: "dark" });
      }
    } finally {
      setClaiming(false);
    }
  };

  const claimAsk = async (key: string) => {
    if (claimingMission) return;
    setClaimingMission(key);
    try {
      const res = await claimMission(key);
      if (res.claimed && userData && typeof res.walletBalance === "number") {
        toogleUserData({ ...userData, walletBalance: res.walletBalance });
      }
      if (res.claimed) {
        pull("happy");
        say("missionDone", { amount: kp(res.reward ?? 0) });
      }
      loadMissions();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || i18n.t("daisu.couldNotClaim"), { theme: "dark" });
    } finally {
      setClaimingMission(null);
    }
  };

  const toggle = () => setOpen((o) => !o);
  const close = () => setOpen(false);
  const clearBurst = () => setBurst(null);

  return {
    enabled,
    open,
    toggle,
    close,
    loaded: !!status,
    fill,
    amount,
    full: status?.full ?? 0,
    isFull,
    hasSomething,
    untilFloor,
    untilFull,
    claim,
    claiming,
    burst,
    clearBurst,
    line,
    face,
    shaking,
    credits,
    pickName,
    pickPath,
    creditShare: status?.creditShare ?? 0.1,
    asks,
    claimAsk,
    claimingMission,
    attention,
    giftReady: gift.canSpin,
  };
};
