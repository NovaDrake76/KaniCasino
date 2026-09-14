import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import UserContext from "../../UserContext";
import { GAME_PLAYED_EVENT } from "../../services/api";
import { claimPot, getPotStatus, PotStatus } from "../../services/daisu/DaisuService";
import { claimMission, getMissions, Mission, visitMission } from "../../services/missions/MissionService";
import { getCases } from "../../services/cases/CaseServices";
import { useGiftStatus } from "../header/useGiftReady";
import { EXPIRING_MS, GAME_ART, GAME_NAME_KEYS, GAME_PATHS, clock, fillAt, kp, msUntil, payout, takeBetween } from "./potMath";
import { greetingFor, lineKey, Mood, pokeMood } from "./daisuLines";
import { setPotStatus, usePotStatus } from "./potStore";
import { DAISU_STAGE_EVENT, emitJarTaken } from "./tour/tourEvents";
import type { BonusView, Face, Line, MissionGroup, Pop, RoomTab, Run, Stage } from "./Daisu.types";
import i18n from "../../i18n";

const STAGE_KEY = "kani.daisuStage";
// the jar moves visibly at four frames a second; the bubble only needs the number
const OPEN_TICK_MS = 250;
const CLOSED_TICK_MS = 1000;
// long enough to read a reaction, short enough that she is not stuck grinning
const FACE_MS = 1800;
// a pause this long ends a run of clicks and sends it to the server as one take
const SETTLE_AFTER_MS = 4000;
// a run that never pauses still settles this often, so the wallet keeps up
const SETTLE_LATEST_MS = 15000;
// clicking an empty jar shakes it every time but she only complains this often
const EMPTY_LINE_EVERY_MS = 2500;
// pokes closer together than this count as one run, which is what makes her escalate
const POKE_WINDOW_MS = 8000;
// a bet can spend a bonus, so the pot is read again after one, but never more often than
// this: dice players bet every second
const BONUS_READ_MS = 3000;
// the bubble alternates between the jar and the gift while a gift is waiting
const BUBBLE_SWAP_MS = 4000;
const POP_MS = 1200;
// a sent or failed run stays under the jar this long, then fades out
const RUN_RESULT_MS = 1600;

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
  const status = usePotStatus();

  const [stage, setStage] = useState<Stage>(readStage);
  const [tab, setTab] = useState<RoomTab>("missions");
  const [now, setNow] = useState(() => Date.now());
  // where the fill stood at the last click: what is between there and now is in the jar
  const [lastClickFill, setLastClickFill] = useState(0);
  const [line, setLine] = useState<Line | null>(null);
  const [face, setFace] = useState<Face>("idle");
  const [shaking, setShaking] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [settling, setSettling] = useState(false);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [caseImage, setCaseImage] = useState<string | undefined>(undefined);
  const [claimingMission, setClaimingMission] = useState<string | null>(null);
  const [bubbleGift, setBubbleGift] = useState(false);

  const faceTimer = useRef<ReturnType<typeof setTimeout>>();
  const shakeTimer = useRef<ReturnType<typeof setTimeout>>();
  const settleTimer = useRef<ReturnType<typeof setTimeout>>();
  const latestTimer = useRef<ReturnType<typeof setTimeout>>();
  const readTimer = useRef<ReturnType<typeof setTimeout>>();
  const runTimer = useRef<ReturnType<typeof setTimeout>>();
  const settlingRef = useRef(false);
  const lastStatusAt = useRef(0);
  // every status write bumps this, so a read that left before a take cannot land after it
  const statusSeq = useRef(0);
  const lastEmptyLineAt = useRef(0);
  const greeted = useRef(false);
  const pokes = useRef({ count: 0, at: 0 });
  // what each bonus was last seen as, so she calls it out once as it runs low and once as it goes
  const calledOut = useRef<Record<string, string>>({});
  // the settle timer runs a callback made on an earlier render, so it reads the pot from these
  const statusRef = useRef<PotStatus | null>(null);
  const lastClickFillRef = useRef(0);
  statusRef.current = status;
  lastClickFillRef.current = lastClickFill;

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

  const addPop = useCallback((amount: number) => {
    const id = Date.now() + Math.random();
    setPops((p) => [...p.slice(-7), { id, amount, x: Math.round((Math.random() - 0.5) * 64) }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), POP_MS);
  }, []);

  // reset forgets the clicks since the last take: right for a take or a failed one, wrong
  // after a bet, which only moves a bonus and leaves the jar where it was
  const refresh = useCallback((reset = true) => {
    lastStatusAt.current = Date.now();
    const seq = ++statusSeq.current;
    getPotStatus()
      .then((s) => {
        if (seq !== statusSeq.current) return;
        setPotStatus(s);
        if (reset) setLastClickFill(0);
      })
      .catch(() => {
        if (seq === statusSeq.current) setPotStatus(null);
      });
  }, []);

  useEffect(() => {
    if (!enabled || !userId) {
      setPotStatus(null);
      greeted.current = false;
      return;
    }
    // an account starts from its own pot, never from whoever was signed in before
    setPotStatus(null);
    refresh();
  }, [enabled, userId, refresh]);

  // only a bet spends a bonus, and one the bonus paid in full leaves the wallet where it was, so
  // the games say when they played. a burst of bets on that game becomes one read
  useEffect(() => {
    if (!enabled) return;
    const onPlayed = (e: Event) => {
      const game = (e as CustomEvent<{ game?: string }>).detail?.game;
      if (!statusRef.current?.bonuses.some((b) => !b.expired && b.game === game)) return;
      if (readTimer.current) clearTimeout(readTimer.current);
      readTimer.current = setTimeout(() => refresh(false), Math.max(0, BONUS_READ_MS - (Date.now() - lastStatusAt.current)));
    };
    window.addEventListener(GAME_PLAYED_EVENT, onPlayed);
    return () => window.removeEventListener(GAME_PLAYED_EVENT, onPlayed);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), stage === "bubble" ? CLOSED_TICK_MS : OPEN_TICK_MS);
    return () => clearInterval(t);
  }, [enabled, stage]);

  useEffect(() => {
    storeStage(stage);
    if (stage === "bubble") greeted.current = false;
  }, [stage]);

  // the tour moves her between stages from outside the dock
  useEffect(() => {
    const onStage = (e: Event) => {
      const next = (e as CustomEvent<Stage>).detail;
      if (next !== "bubble" && next !== "popup" && next !== "room") return;
      if (next === "room") setTab("missions");
      setStage(next);
    };
    window.addEventListener(DAISU_STAGE_EVENT, onStage);
    return () => window.removeEventListener(DAISU_STAGE_EVENT, onStage);
  }, []);

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

  // the server says which bonuses were live when it answered; the clock here keeps them honest
  // until the next answer, so one runs out on screen the moment it runs out
  const ttlMs = status?.creditTtlMs ?? cycleMs;
  const bonuses: BonusView[] = status
    ? status.bonuses
        .map((b) => {
          const msLeft = b.expiresAt ? Math.max(0, Date.parse(b.expiresAt) - now) : 0;
          const expired = b.expired || msLeft <= 0;
          return {
            key: `${b.game}:${b.expiresAt}`,
            game: b.game,
            name: i18n.t(GAME_NAME_KEYS[b.game]),
            path: GAME_PATHS[b.game],
            art: GAME_ART[b.game],
            amount: b.amount,
            msLeft,
            clock: clock(msLeft),
            left: ttlMs > 0 ? Math.min(1, msLeft / ttlMs) : 0,
            expiring: !expired && msLeft <= EXPIRING_MS,
            expired,
          };
        })
        .sort((a, b) => Number(a.expired) - Number(b.expired) || b.msLeft - a.msLeft)
    : [];
  const liveBonuses = bonuses.filter((b) => !b.expired);
  const bubbleBonus = liveBonuses[0] ?? null;

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
    const soon = liveBonuses.find((b) => b.expiring);
    const gone = liveBonuses.length ? undefined : bonuses.find((b) => b.expired);
    const mood = greetingFor({
      fill,
      holdsCredit: liveBonuses.length > 0,
      missionReady,
      giftReady: gift.canSpin,
      wallet,
      bonusExpiring: !!soon,
      bonusExpired: !!gone,
    });
    const about = soon ?? gone ?? liveBonuses[0];
    say(mood, {
      amount: kp(inJar),
      clock: untilFull,
      left: about?.clock ?? "",
      credit: kp(about?.amount ?? 0),
      game: about?.name ?? pickName,
    });
    // reads the derived values of the moment it opened; later ticks must not re-greet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, status]);

  // the first sight of a bonus is silent, since opening the card already greets with it
  useEffect(() => {
    for (const b of bonuses) {
      const state = b.expired ? "expired" : b.expiring ? "expiring" : "live";
      const was = calledOut.current[b.key];
      if (was === state) continue;
      calledOut.current[b.key] = state;
      if (!was || stage === "bubble") continue;
      if (state === "expiring") say("bonusExpiring", { game: b.name, left: b.clock });
      if (state === "expired") {
        say("bonusExpired", { game: b.name, credit: kp(b.amount) });
        pull("sad");
      }
    }
    // the tick is what moves a bonus along; the rest is read as it stands
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, status]);

  // how a run ends: the server's number in green, or the clicked number in red. either way it
  // fades, unless a new run has already started in its place
  const endRun = useCallback((state: "sent" | "failed", amount?: number) => {
    setRun((r) => (r ? { ...r, state, amount: amount ?? r.amount } : r));
    if (runTimer.current) clearTimeout(runTimer.current);
    runTimer.current = setTimeout(
      () => setRun((r) => (r && (r.state === "sent" || r.state === "failed") ? null : r)),
      RUN_RESULT_MS
    );
  }, []);

  const settle = useCallback(async () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (latestTimer.current) clearTimeout(latestTimer.current);
    settleTimer.current = undefined;
    latestTimer.current = undefined;
    // clicks while a take is in flight join it: the server prices up to the moment it runs
    if (settlingRef.current) return;
    settlingRef.current = true;
    setSettling(true);
    // the jar kept filling through the pause and the server takes all of it, so it is poured
    // into the run first: the number that turns green is then the one that piled up on screen
    const s = statusRef.current;
    const fillNow = s ? fillAt(s.fullAt, s.cycleMs, Date.now()) : 0;
    const rest = s ? takeBetween(s.full, lastClickFillRef.current, fillNow) : 0;
    if (rest >= 1) {
      setLastClickFill(fillNow);
      addPop(rest);
    }
    setRun((r) => (r && r.state === "open" ? { ...r, amount: r.amount + (rest >= 1 ? rest : 0), state: "sending" } : r));
    try {
      const res = await claimPot();
      lastStatusAt.current = Date.now();
      statusSeq.current += 1;
      setPotStatus(res.status);
      setLastClickFill(0);
      if (userData) toogleUserData({ ...userData, walletBalance: res.walletBalance, nextBonus: res.nextBonus });
      endRun("sent", res.amount);
      if (res.pickChanged) {
        say("pickChanged", { game: i18n.t(GAME_NAME_KEYS[res.status.pick]) });
      } else if (res.credit >= 1) {
        say("claimedCredit", { amount: kp(res.amount), credit: kp(res.credit), game: i18n.t(GAME_NAME_KEYS[res.pick]) });
      } else {
        say("claimed", { amount: kp(res.amount) });
      }
      pull("happy");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { reason?: string } } };
      const reason = e?.response?.data?.reason;
      // nothing was taken, so the pot still holds every coin of the run: re-read it
      refresh();
      if (reason === "raced") {
        // another tab took this pot first, so the coins did land, only not from here
        setRun(null);
      } else {
        endRun("failed");
        shake();
        pull("sad");
        say(reason === "empty" ? "empty" : "failed");
      }
    } finally {
      settlingRef.current = false;
      setSettling(false);
    }
    // userData is read at settle time on purpose; the wallet it carries is the base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, toogleUserData, say, pull, shake, refresh, endRun, addPop]);

  const scheduleSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, SETTLE_AFTER_MS);
    if (!latestTimer.current) latestTimer.current = setTimeout(settle, SETTLE_LATEST_MS);
  }, [settle]);

  // a hidden tab may never come back, so a run waiting out its pause is sent right away
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && settleTimer.current) settle();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [settle]);

  // a run left hanging when she unmounts is still sent: the coins are priced by time,
  // so nothing is lost either way, but the wallet should not lag until next visit
  useEffect(
    () => () => {
      if (faceTimer.current) clearTimeout(faceTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
      if (runTimer.current) clearTimeout(runTimer.current);
      if (readTimer.current) clearTimeout(readTimer.current);
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
      // mid-run the jar is only catching up between fast clicks, which is not worth a complaint
      if (run && (run.state === "open" || run.state === "sending")) return;
      pull("surprised");
      if (Date.now() - lastEmptyLineAt.current > EMPTY_LINE_EVERY_MS) {
        lastEmptyLineAt.current = Date.now();
        const readyFill = Math.min(1, lastClickFill + (full > 0 ? 1 / (full * 0.8) : 1));
        say("empty", { clock: clock(msUntil(status.fullAt, cycleMs, readyFill, now)) });
      }
      return;
    }
    setLastClickFill(fill);
    const t = Date.now();
    addPop(delta);
    emitJarTaken();
    setRun((r) =>
      r && (r.state === "open" || r.state === "sending")
        ? { ...r, amount: r.amount + delta, lastClickAt: t }
        : { id: t + Math.random(), amount: delta, state: "open", lastClickAt: t }
    );
    pull("happy");
    if (!settlingRef.current) scheduleSettle();
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
    run,
    settleMs: SETTLE_AFTER_MS,
    line,
    face,
    shaking,
    bonuses,
    bubbleBonus,
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
