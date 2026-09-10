import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import { claimPot, getPotStatus, PotStatus } from "../../services/daisu/DaisuService";
import { claimMission, getMissions, Mission, visitMission } from "../../services/missions/MissionService";
import { getCases } from "../../services/cases/CaseServices";
import { useGiftStatus } from "../header/useGiftReady";
import { GAME_NAME_KEYS, GAME_PATHS, clock, fillAt, kp, msUntil, payout, takeBetween } from "./potMath";
import { greetingFor, lineKey, Mood, pokeMood } from "./daisuLines";
import type { CreditView, Face, Line, MissionGroup, Pop, RoomTab, Stage } from "./Daisu.types";
import i18n from "../../i18n";

const STAGE_KEY = "kani.daisuStage";
// the jar moves visibly at four frames a second; the bubble only needs the number
const OPEN_TICK_MS = 250;
const CLOSED_TICK_MS = 1000;
// long enough to read a reaction, short enough that she is not stuck grinning
const FACE_MS = 1800;
// a pause this long ends a run of clicks and sends it to the server as one take
const SETTLE_AFTER_MS = 1500;
// a run that never pauses still settles this often, so the wallet keeps up
const SETTLE_LATEST_MS = 15000;
// clicking an empty jar shakes it every time but she only complains this often
const EMPTY_LINE_EVERY_MS = 2500;
// pokes closer together than this count as one run, which is what makes her escalate
const POKE_WINDOW_MS = 8000;
// a bet can spend a credit, so the dock re-reads after the wallet moves, but never more
// often than this: dice players bet every second
const WALLET_REFRESH_MS = 3000;
// the bubble alternates between the jar and the gift while a gift is waiting
const BUBBLE_SWAP_MS = 4000;
const POP_MS = 1200;

// the card starts open on a desktop, which is how a player finds out she exists; on a
// phone it would cover the games, so it starts as the bubble. the room is never restored.
const readStage = (): Stage => {
  const wide = window.innerWidth >= 768;
  try {
    const stored = window.localStorage.getItem(STAGE_KEY);
    if (stored === "popup" || stored === "bubble") return stored;
  } catch {
    // storage blocked: fall through to the default
  }
  return wide ? "popup" : "bubble";
};

const storeStage = (stage: Stage) => {
  if (stage === "room") return;
  try {
    window.localStorage.setItem(STAGE_KEY, stage);
  } catch {
    // storage blocked: it opens again next visit, which is fine
  }
};

// the same grouping the missions tab uses, resolved per render for the language
const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "missions.gettingStarted",
  games: "missions.games",
  collection: "missions.collection",
  community: "missions.community",
  endgame: "missions.allIn",
};
const CATEGORY_ORDER = ["onboarding", "games", "collection", "community", "endgame"];

export const groupMissions = (missions: Mission[]): MissionGroup[] =>
  CATEGORY_ORDER.map((key) => ({
    key,
    label: i18n.t(CATEGORY_LABELS[key]),
    missions: missions.filter((m) => m.category === key),
  })).filter((g) => g.missions.length > 0);

export const useDaisu = () => {
  const { userData, toogleUserData } = useContext(UserContext);
  const enabled = !!userData?.features?.daisu;
  const userId: string | undefined = userData?.id;
  const wallet: number = userData?.walletBalance ?? 0;
  const gift = useGiftStatus();

  const [status, setStatus] = useState<PotStatus | null>(null);
  const [stage, setStage] = useState<Stage>(readStage);
  const [tab, setTab] = useState<RoomTab>("missions");
  const [now, setNow] = useState(() => Date.now());
  // where the fill stood at the last click: what is between there and now is in the jar
  const [lastClickFill, setLastClickFill] = useState(0);
  const [line, setLine] = useState<Line | null>(null);
  const [face, setFace] = useState<Face>("idle");
  const [shaking, setShaking] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const [settling, setSettling] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [caseImage, setCaseImage] = useState<string | undefined>(undefined);
  const [claimingMission, setClaimingMission] = useState<string | null>(null);
  const [bubbleGift, setBubbleGift] = useState(false);

  const faceTimer = useRef<ReturnType<typeof setTimeout>>();
  const shakeTimer = useRef<ReturnType<typeof setTimeout>>();
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  const latestTimer = useRef<ReturnType<typeof setTimeout>>();
  const settlingRef = useRef(false);
  const settleAgain = useRef(false);
  const lastStatusAt = useRef(0);
  const lastEmptyLineAt = useRef(0);
  const greeted = useRef(false);
  const pokes = useRef({ count: 0, at: 0 });

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
    shakeTimer.current = setTimeout(() => setShaking(false), 450);
  }, []);

  const refresh = useCallback(() => {
    lastStatusAt.current = Date.now();
    getPotStatus()
      .then((s) => {
        setStatus(s);
        setLastClickFill(0);
      })
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

  // only a held credit can change between takes, and only a bet spends it
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
    const t = setInterval(() => setNow(Date.now()), stage === "bubble" ? CLOSED_TICK_MS : OPEN_TICK_MS);
    return () => clearInterval(t);
  }, [enabled, stage]);

  useEffect(() => {
    storeStage(stage);
    if (stage === "bubble") greeted.current = false;
  }, [stage]);

  // her room covers the page, so the page must not scroll under it
  useEffect(() => {
    if (stage !== "room") return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStage("popup");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [stage]);

  useEffect(() => {
    if (!enabled || stage !== "bubble" || !gift.canSpin) {
      setBubbleGift(false);
      return;
    }
    const t = setInterval(() => setBubbleGift((g) => !g), BUBBLE_SWAP_MS);
    return () => clearInterval(t);
  }, [enabled, stage, gift.canSpin]);

  const loadMissions = useCallback(() => {
    getMissions()
      .then((d) => setMissions(d.missions))
      .catch(() => setMissions([]));
  }, []);

  useEffect(() => {
    if (!enabled || stage !== "room" || !userId) return;
    loadMissions();
    // a real case image for the case missions, the chest icon if it fails
    getCases()
      .then((cases) => {
        const img = Array.isArray(cases) ? cases.find((c) => c && c.image)?.image : undefined;
        if (img) setCaseImage(img);
      })
      .catch(() => {
        // fall back to the chest icon
      });
  }, [enabled, stage, userId, loadMissions]);

  const cycleMs = status?.cycleMs ?? 8 * 60000;
  const full = status?.full ?? 0;
  const fill = status ? fillAt(status.fullAt, cycleMs, now) : 0;
  const inJar = status ? takeBetween(full, lastClickFill, fill) : 0;
  const jarLevel = lastClickFill >= 1 ? 0 : Math.max(0, (fill - lastClickFill) / (1 - lastClickFill));
  const isFull = fill >= 1;
  // clicked but not yet sent: the wallet catches up when the run settles
  const pending = status ? payout(full, lastClickFill) : 0;
  const fresh = lastClickFill === 0;
  const untilFull = status ? clock(msUntil(status.fullAt, cycleMs, 1, now)) : "";
  const fullBonusPct = Math.round((status?.fullBonus ?? 0.25) * 100);
  const creditSharePct = Math.round((status?.creditShare ?? 0.1) * 100);

  const credits: CreditView[] = status
    ? (Object.entries(status.credits) as [CreditView["game"], number][])
        .filter(([, n]) => (n || 0) > 0)
        .map(([game, n]) => ({ game, amount: n, path: GAME_PATHS[game], name: i18n.t(GAME_NAME_KEYS[game]) }))
    : [];
  const pickName = status ? i18n.t(GAME_NAME_KEYS[status.pick]) : "";
  const pickPath = status ? GAME_PATHS[status.pick] : "/";
  const nextPickName = status ? i18n.t(GAME_NAME_KEYS[status.nextPick]) : "";
  const pickProgress = status?.pickProgress ?? 0;
  const pickRemaining = Math.max(0, Math.ceil(full * (1 - pickProgress)));

  const groups = groupMissions(missions);
  const missionReady = missions.some((m) => m.claimable && !m.claimed);
  const attention = isFull || missionReady || gift.canSpin;

  // she speaks once per opening, once there is something to speak about
  useEffect(() => {
    if (stage === "bubble" || !status || greeted.current) return;
    greeted.current = true;
    const mood = greetingFor({ fill, holdsCredit: credits.length > 0, missionReady, giftReady: gift.canSpin, wallet });
    const first = credits[0];
    say(mood, {
      amount: kp(inJar),
      clock: untilFull,
      credit: kp(first?.amount ?? 0),
      game: first?.name ?? pickName,
    });
    // reads the derived values of the moment it opened; later ticks must not re-greet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, status]);

  const settle = useCallback(async () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (latestTimer.current) clearTimeout(latestTimer.current);
    settleTimer.current = undefined;
    latestTimer.current = undefined;
    if (settlingRef.current) {
      settleAgain.current = true;
      return;
    }
    settlingRef.current = true;
    setSettling(true);
    try {
      const res = await claimPot();
      lastStatusAt.current = Date.now();
      setStatus(res.status);
      setLastClickFill(0);
      if (userData) toogleUserData({ ...userData, walletBalance: res.walletBalance, nextBonus: res.nextBonus });
      if (res.pickChanged) {
        say("pickChanged", { game: i18n.t(GAME_NAME_KEYS[res.status.pick]) });
      } else if (res.credit >= 1) {
        say("claimedCredit", { amount: kp(res.amount), credit: kp(res.credit), game: i18n.t(GAME_NAME_KEYS[res.pick]) });
      } else {
        say("claimed", { amount: kp(res.amount) });
      }
      pull("happy");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { reason?: string; message?: string } } };
      const reason = e?.response?.data?.reason;
      if (reason === "empty" || reason === "raced") refresh();
      else toast.error(e?.response?.data?.message || i18n.t("daisu.couldNotClaim"), { theme: "dark" });
    } finally {
      settlingRef.current = false;
      setSettling(false);
      if (settleAgain.current) {
        settleAgain.current = false;
        settleTimer.current = setTimeout(settle, SETTLE_AFTER_MS);
      }
    }
    // userData is read at settle time on purpose; the wallet it carries is the base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, toogleUserData, say, pull, refresh]);

  const scheduleSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, SETTLE_AFTER_MS);
    if (!latestTimer.current) latestTimer.current = setTimeout(settle, SETTLE_LATEST_MS);
  }, [settle]);

  // a run left hanging when she unmounts is still sent: the coins are priced by time,
  // so nothing is lost either way, but the wallet should not lag until next visit
  useEffect(
    () => () => {
      if (faceTimer.current) clearTimeout(faceTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (latestTimer.current) clearTimeout(latestTimer.current);
      if (settleTimer.current) {
        clearTimeout(settleTimer.current);
        claimPot().catch(() => undefined);
      }
    },
    []
  );

  const takeFromJar = () => {
    if (!status) return;
    const delta = takeBetween(full, lastClickFill, fill);
    if (delta < 1) {
      shake();
      pull("surprised");
      if (Date.now() - lastEmptyLineAt.current > EMPTY_LINE_EVERY_MS) {
        lastEmptyLineAt.current = Date.now();
        const readyFill = Math.min(1, lastClickFill + (full > 0 ? 1 / (full * 0.8) : 1));
        say("empty", { clock: clock(msUntil(status.fullAt, cycleMs, readyFill, now)) });
      }
      return;
    }
    setLastClickFill(fill);
    const id = Date.now() + Math.random();
    setPops((p) => [...p.slice(-4), { id, amount: delta }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), POP_MS);
    pull("happy");
    scheduleSettle();
  };

  const poke = () => {
    const t = Date.now();
    if (t - pokes.current.at > POKE_WINDOW_MS) pokes.current.count = 0;
    pokes.current = { count: pokes.current.count + 1, at: t };
    const mood = pokeMood(pokes.current.count);
    say(mood);
    pull(mood === "poke2" ? "happy" : mood === "poke1" ? "sad" : "surprised");
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
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || i18n.t("missions.couldNotClaimReward"), { theme: "dark" });
    } finally {
      setClaimingMission(null);
    }
  };

  const visitAsk = async (key: string, url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      await visitMission(key);
    } catch {
      // honor-system: marking the visit is best-effort
    }
    loadMissions();
  };

  const openPopup = () => setStage("popup");
  const closeToBubble = () => setStage("bubble");
  const openRoom = () => {
    setStage("room");
    say("room");
  };
  const backToPopup = () => setStage("popup");

  return {
    enabled,
    stage,
    openPopup,
    closeToBubble,
    openRoom,
    backToPopup,
    tab,
    setTab,
    loaded: !!status,
    fill: jarLevel,
    inJar,
    full,
    fresh,
    isFull,
    pending,
    settling,
    untilFull,
    fullBonusPct,
    creditSharePct,
    takeFromJar,
    poke,
    pops,
    line,
    face,
    shaking,
    credits,
    pickName,
    pickPath,
    nextPickName,
    pickProgress,
    pickRemaining,
    groups,
    caseImage,
    claimAsk,
    visitAsk,
    claimingMission,
    missionReady,
    attention,
    giftReady: gift.canSpin,
    bubbleGift,
  };
};
