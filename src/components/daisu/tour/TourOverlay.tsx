import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { FiCheck, FiX } from "react-icons/fi";
import UserContext from "../../../UserContext";
import TourBubble from "./TourBubble";
import TypedText from "../TypedText";
import { useTarget } from "./useTarget";
import { Backdrop, CasePicker, Chip, GamePicker, Guided, PlayStep, Spotlight } from "./tourParts";
import {
  CASE_REVEALED_EVENT,
  DAISU_POKED_EVENT,
  GAME_RESULT_EVENT,
  GameResult,
  JAR_TAKEN_EVENT,
  RevealedItem,
  showDaisu,
} from "./tourEvents";
import { endTour, finishTour, goTo, setPokeMode, startTour, syncTour, TourState, useTour } from "./tourStore";
import { TourGameInfo, tourGame } from "./tourGames";
import { rarityName } from "../../../utils/rarity";
import { visitMission, getPendingMissions } from "../../../services/missions/MissionService";
import { toastMissionComplete } from "../../../pages/Missions/components/missionCompleteToast";
import i18n from "../../../i18n";

// long enough to take in how the round landed before the closing card covers it
const RESULT_BEAT_MS = 4000;
// her lines for a player who pokes her instead of the jar, one per poke; from this one on, the jar's outline is drawn bolder
const POKE_LINES = 36;
const BOLD_FROM = 4;
const SECRET = "men-kisser";
const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.tour.${key}`, vars);

// the open button tells her when the case costs more than the player holds, and when it is
// rolling, which is when she points at the reel instead
const OpenStep = ({ eyebrow, onEnd, onPickAnother }: { eyebrow: string; onEnd: () => void; onPickAnother: () => void }) => {
  const button = useTarget("case-open");
  const rolling = button.state === "busy";
  const tooDear = button.state === "too-expensive";
  const reel = useTarget(rolling ? "case-prize" : null);
  const rect = rolling ? reel.rect || button.rect : button.rect;
  return (
    <>
      <Spotlight rect={rect} />
      <TourBubble
        rect={rect}
        eyebrow={eyebrow}
        line={t(rolling ? "rollLine" : tooDear ? "openTooDear" : "openLine")}
        step={2}
        wait={tooDear ? undefined : t(rolling ? "rollWait" : "openWait")}
        next={tooDear ? { label: t("pickAnother"), onClick: onPickAnother } : undefined}
        onEnd={onEnd}
      />
    </>
  );
};

// her card starts closed, so the first thing learned is where she lives; once open, the jar is clicked for the first KP
const PotStep = ({ eyebrow, owner, onNext, onEnd }: { eyebrow: string; owner: string; onNext: () => void; onEnd: () => void }) => {
  const jar = useTarget("daisu-jar");
  const [taken, setTaken] = useState(false);
  const [pokes, setPokes] = useState(0);

  useEffect(() => {
    document.body.classList.add("daisu-still");
    const onTaken = () => setTaken(true);
    window.addEventListener(JAR_TAKEN_EVENT, onTaken);
    return () => {
      document.body.classList.remove("daisu-still");
      window.removeEventListener(JAR_TAKEN_EVENT, onTaken);
      setPokeMode(null);
    };
  }, []);

  useEffect(() => {
    if (taken) return setPokeMode(null);
    setPokeMode(pokes >= POKE_LINES ? "locked" : "script");
  }, [taken, pokes]);

  useEffect(() => {
    if (taken) return;
    const onPoked = () =>
      setPokes((n) => {
        if (n + 1 === POKE_LINES) {
          visitMission(SECRET)
            .then(() => getPendingMissions(true))
            .then((pending) => pending.forEach((m) => toastMissionComplete(m, `/profile/${owner}?tab=missions`)))
            .catch(() => undefined);
        }
        return Math.min(n + 1, POKE_LINES);
      });
    window.addEventListener(DAISU_POKED_EVENT, onPoked);
    return () => window.removeEventListener(DAISU_POKED_EVENT, onPoked);
  }, [taken, owner]);

  if (!jar.present && !taken) {
    return <Guided target="daisu-bubble" eyebrow={eyebrow} line={t("openMeLine")} step={1} wait={t("openMeWait")} onEnd={onEnd} />;
  }
  const line = taken ? t("potTaken") : pokes ? t(`pokes.${pokes - 1}`) : t("potLine");
  return (
    <Guided
      target={jar.present ? "daisu-jar" : "daisu-bubble"}
      anchor={jar.present ? "daisu-card" : undefined}
      bold={!taken && pokes >= BOLD_FROM}
      eyebrow={eyebrow}
      line={line}
      step={1}
      wait={taken ? undefined : t("potWait")}
      next={taken ? { label: t("next"), onClick: onNext } : undefined}
      onEnd={onEnd}
    />
  );
};

const Welcome = ({ name, returning, onStart, onDecline }: { name: string; returning: boolean; onStart: () => void; onDecline: () => void }) => {
  const title = returning ? t("welcomeBackTitle", { name }) : t("welcomeTitle");
  return (
    <Backdrop>
      <div role="dialog" aria-label={title} className="relative flex max-h-full w-full flex-col overflow-y-auto bg-surface shadow-2xl md:w-[640px] md:flex-row">
        <button
          type="button"
          onClick={onDecline}
          aria-label={i18n.t("daisu.close")}
          className="absolute right-2 top-2 border-none bg-transparent p-2 text-ink-faint hover:border-none hover:text-ink-soft"
        >
          <FiX />
        </button>
        <div className="hidden w-[220px] shrink-0 items-end justify-center bg-surface-nav px-2.5 pt-5 md:flex">
          <img src="/images/daisu/idle.webp" alt="" className="block h-[290px] w-auto" />
        </div>
        <div className="flex flex-col gap-4 px-5 pb-6 pt-5 md:px-8 md:pb-7 md:pt-8">
          <div className="flex items-end gap-3.5">
            <img src="/images/daisu/bust.webp" alt="" className="h-14 w-14 object-contain object-top md:hidden" />
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">Daisu</span>
              <h2 className="m-0 text-2xl font-extrabold leading-tight md:text-[28px]">{title}</h2>
            </div>
          </div>
          <p className="m-0 text-sm leading-relaxed text-ink-soft md:text-[15px]">
            <TypedText text={returning ? t("welcomeBackBody") : t("welcomeBody", { name })} />
          </p>
          <div className="flex flex-col gap-2 md:mt-2 md:flex-row">
            <button
              type="button"
              onClick={onStart}
              className="h-12 rounded-md border-none bg-accent px-5 text-[15px] font-bold text-white hover:border-none hover:bg-accent-light md:h-10 md:text-sm"
            >
              {t("start")}
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="h-12 rounded-md border-none bg-surface-nav px-4 text-[15px] font-semibold text-ink-soft hover:border-none hover:bg-surface-hover md:h-10 md:text-sm"
            >
              {t("decline")}
            </button>
          </div>
          <span className="text-xs text-ink-faint">{t("endAnyTime")}</span>
        </div>
      </div>
    </Backdrop>
  );
};

const doneLine = (result: GameResult | null) => {
  if (result && result.payout > result.wagered) return "doneWin";
  if (result && result.payout === result.wagered) return "doneEven";
  return "doneLose";
};

const DoneCard = ({ tour, onMissions, onLater }: { tour: TourState; onMissions: () => void; onLater: () => void }) => {
  const game = tourGame(tour.game);
  return (
    <Backdrop>
      <div role="dialog" aria-label={t("doneTitle")} className="flex max-h-full w-full flex-col overflow-y-auto bg-surface shadow-2xl md:w-[520px]">
        <div className="flex gap-4 px-5 pb-4 pt-6 md:px-6">
          <img src="/images/daisu/idle.webp" alt="" className="block h-32 w-auto shrink-0 md:h-[170px]" />
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">{t("doneTitle")}</span>
            <p className="m-0 text-sm leading-normal text-ink-soft">
              <TypedText text={t(doneLine(tour.result))} />
            </p>
            <p className="m-0 text-sm leading-normal text-ink-soft">
              <TypedText text={t("doneOut")} />
            </p>
          </div>
        </div>
        <div className="mx-5 grid grid-cols-3 gap-px bg-line md:mx-6">
          <div className="flex min-w-0 flex-col gap-0.5 bg-surface-nav px-3 py-2.5">
            <span className="text-xs font-semibold text-ink-muted">{t("statPot")}</span>
            <FiCheck className="text-sm text-accent-gold" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 bg-surface-nav px-3 py-2.5">
            <span className="text-xs font-semibold text-ink-muted">{t("statCase")}</span>
            <b className="truncate text-sm">{tour.drop ? tour.drop.name : <FiCheck className="text-accent-gold" />}</b>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 bg-surface-nav px-3 py-2.5">
            <span className="text-xs font-semibold text-ink-muted">{t("statGame")}</span>
            <b className="truncate text-sm">{game ? i18n.t(game.nameKey) : <FiCheck className="text-accent-gold" />}</b>
          </div>
        </div>
        <div className="flex flex-col gap-2 px-5 pb-6 pt-4 md:flex-row md:px-6">
          <button
            type="button"
            onClick={onMissions}
            className="h-12 rounded-md border-none bg-accent px-5 text-sm font-bold text-white hover:border-none hover:bg-accent-light md:h-10"
          >
            {t("showMissions")}
          </button>
          <button
            type="button"
            onClick={onLater}
            className="h-12 rounded-md border-none bg-surface-nav px-4 text-sm font-semibold text-ink-soft hover:border-none hover:bg-surface-hover md:h-10"
          >
            {t("later")}
          </button>
        </div>
      </div>
    </Backdrop>
  );
};

// each step belongs to a page; away from it, the tour waits as a chip instead of pointing at nothing
const onRoute = (step: string, pathname: string, game: TourGameInfo | null) => {
  if (step === "open" || step === "drop") return pathname.startsWith("/case/");
  if (step === "bet" || step === "range" || step === "play") return !!game && pathname === game.path;
  return true;
};

const best = (items: RevealedItem[]) => items.reduce((a, b) => (Number(b.rarity) > Number(a.rarity) ? b : a), items[0]);

// daisu's first-login tour: the pot, a case, a game, each pointed at on the real page and
// waited for, with a way out on every step
const TourOverlay = () => {
  const { userData } = useContext(UserContext);
  const owner = userData?.features?.daisu ? userData.id : null;
  const serverStatus = userData?.onboarding?.status ?? null;
  const serverStep = userData?.onboarding?.step ?? null;
  const serverReturning = !!userData?.onboarding?.returning;
  const tour = useTour();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const game = tourGame(tour.game);
  const step = tour.status === "active" ? tour.step : null;

  useEffect(() => {
    if (!owner) return;
    syncTour(owner, serverStatus ? { status: serverStatus, step: serverStep, returning: serverReturning } : null);
  }, [owner, serverStatus, serverStep, serverReturning]);

  useEffect(() => {
    if (step === "case" && pathname.startsWith("/case/")) goTo("open");
  }, [step, pathname]);

  useEffect(() => {
    if (step !== "open") return;
    const onRevealed = (e: Event) => {
      const items = (e as CustomEvent<{ items: RevealedItem[] }>).detail?.items || [];
      goTo("drop", { drop: items.length ? best(items) : null });
    };
    window.addEventListener(CASE_REVEALED_EVENT, onRevealed);
    return () => window.removeEventListener(CASE_REVEALED_EVENT, onRevealed);
  }, [step]);

  // a reload keeps the step but not what this tab saw, so it picks up again from the games
  useEffect(() => {
    if (step === "drop" && !tour.drop) goTo("game");
    if ((step === "bet" || step === "range" || step === "play") && !game) goTo("game");
  }, [step, tour.drop, game]);

  // a round played before pressing next on the bet counts just the same
  useEffect(() => {
    if ((step !== "bet" && step !== "range" && step !== "play") || !game) return;
    let timer = 0;
    const onResult = (e: Event) => {
      const result = (e as CustomEvent<GameResult>).detail;
      if (timer || !result || result.game !== game.key) return;
      timer = window.setTimeout(() => goTo("done", { result }), RESULT_BEAT_MS);
    };
    window.addEventListener(GAME_RESULT_EVENT, onResult);
    return () => {
      window.removeEventListener(GAME_RESULT_EVENT, onResult);
      window.clearTimeout(timer);
    };
  }, [step, game]);

  if (!owner || !tour.status || pathname.startsWith("/link/")) return null;

  const stepTitle = (n: number, title: string) => `${t("stepOf", { n })} · ${title}`;
  const name = String(userData?.username || "").trim().split(/\s+/)[0];
  const start = () => {
    showDaisu("bubble");
    startTour();
  };
  const toCases = () => {
    showDaisu("bubble");
    goTo("case");
    navigate("/");
  };
  const pick = (g: TourGameInfo) => {
    showDaisu("bubble");
    goTo("bet", { game: g.key });
    navigate(g.path);
  };
  const resume = () => {
    if (step === "drop") return goTo("game");
    if ((step === "bet" || step === "range" || step === "play") && game) return navigate(game.path);
    toCases();
  };
  const dropLine = (drop: RevealedItem) => {
    const rarity = Math.min(5, Math.max(1, Math.round(Number(drop.rarity)) || 1));
    return t(`drop.${rarity}`, { item: drop.name, rarity: rarityName(rarity) });
  };

  let content: JSX.Element | null = null;
  if (tour.status === "offered") {
    content = <Welcome name={name} returning={tour.returning} onStart={start} onDecline={endTour} />;
  } else if (step && !onRoute(step, pathname, game)) {
    content = (
      <Chip endLabel={t("end")} onEnd={endTour}>
        <button
          type="button"
          onClick={resume}
          className="h-10 whitespace-nowrap rounded-md border-none bg-accent px-4 text-sm font-bold text-white hover:border-none hover:bg-accent-light"
        >
          {t("continue")}
        </button>
      </Chip>
    );
  } else if (step === "pot") {
    content = <PotStep eyebrow={stepTitle(1, t("titlePot"))} owner={owner} onNext={toCases} onEnd={endTour} />;
  } else if (step === "case") {
    content = (
      <CasePicker
        eyebrow={stepTitle(2, t("titleCase"))}
        line={t("caseLine")}
        endLabel={t("end")}
        onPick={(id) => navigate(`/case/${id}`)}
        onEnd={endTour}
      />
    );
  } else if (step === "open") {
    content = <OpenStep eyebrow={stepTitle(2, t("titleCase"))} onEnd={endTour} onPickAnother={toCases} />;
  } else if (step === "drop" && tour.drop) {
    content = (
      <Guided
        target="case-prize"
        eyebrow={stepTitle(2, t("titleCase"))}
        line={dropLine(tour.drop)}
        step={2}
        next={{ label: t("next"), onClick: () => goTo("game") }}
        onEnd={endTour}
      />
    );
  } else if (step === "game") {
    content = <GamePicker eyebrow={stepTitle(3, t("titleGame"))} line={t("gamesLine")} step={3} endLabel={t("end")} onPick={pick} onEnd={endTour} />;
  } else if (step === "bet" && game) {
    content = (
      <Guided
        target="bet-input"
        eyebrow={stepTitle(3, i18n.t(game.nameKey))}
        line={t(`bet.${game.key}`)}
        step={3}
        next={{ label: t("next"), onClick: () => goTo(game.key === "dice" ? "range" : "play") }}
        onEnd={endTour}
      />
    );
  } else if (step === "range" && game) {
    content = (
      <Guided
        target="dice-range"
        eyebrow={stepTitle(3, i18n.t(game.nameKey))}
        line={t("rangeLine")}
        step={3}
        next={{ label: t("next"), onClick: () => goTo("play") }}
        onEnd={endTour}
      />
    );
  } else if (step === "play" && game) {
    content = <PlayStep eyebrow={stepTitle(3, i18n.t(game.nameKey))} line={t("playLine")} step={3} endLabel={t("end")} onEnd={endTour} />;
  } else if (step === "done") {
    content = (
      <DoneCard
        tour={tour}
        onMissions={() => {
          finishTour();
          showDaisu("room");
        }}
        onLater={finishTour}
      />
    );
  }

  if (!content) return null;
  // the portal sits outside the app's wrapper, so it sets its own text colour
  return createPortal(<div className="pointer-events-none fixed inset-0 z-[150] text-white">{content}</div>, document.body);
};

export default TourOverlay;
