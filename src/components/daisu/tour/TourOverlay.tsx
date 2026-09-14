import { useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { FiCheck, FiX } from "react-icons/fi";
import UserContext from "../../../UserContext";
import TourBubble from "./TourBubble";
import { Rect, useTarget } from "./useTarget";
import { CASE_REVEALED_EVENT, GAME_RESULT_EVENT, GameResult, JAR_TAKEN_EVENT, RevealedItem, showDaisu } from "./tourEvents";
import { endTour, finishTour, goTo, startTour, syncTour, TourState, useTour } from "./tourStore";
import { TOUR_GAMES, TourGameInfo, tourGame } from "./tourGames";
import { kp } from "../potMath";
import { rarityName } from "../../../utils/rarity";
import i18n from "../../../i18n";

const DIM = "rgba(9, 7, 20, 0.74)";
const PAD = 6;
// a beat to see how the round landed before the closing card covers it
const RESULT_BEAT_MS = 1200;
const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.tour.${key}`, vars);

// four dim panels around the target rather than one sheet over it, so the target stays clickable.
// undimmed, only the outline is drawn and the page stays usable around it
const Spotlight = ({ rect, dim = true }: { rect: Rect | null; dim?: boolean }) => {
  if (!rect) return null;
  const top = rect.top - PAD;
  const left = rect.left - PAD;
  const width = rect.width + PAD * 2;
  const height = rect.height + PAD * 2;
  const outline = (
    <div
      className="pointer-events-none fixed"
      style={{ top, left, width, height, outline: "2px solid #FFCC00", boxShadow: "0 0 36px 10px rgba(255, 204, 0, 0.28)" }}
    />
  );
  if (!dim) return outline;
  return (
    <>
      <div className="pointer-events-auto fixed inset-x-0 top-0" style={{ height: Math.max(0, top), background: DIM }} />
      <div className="pointer-events-auto fixed inset-x-0 bottom-0" style={{ top: top + height, background: DIM }} />
      <div className="pointer-events-auto fixed left-0" style={{ top, height, width: Math.max(0, left), background: DIM }} />
      <div className="pointer-events-auto fixed right-0" style={{ top, height, left: left + width, background: DIM }} />
      {outline}
    </>
  );
};

interface GuidedProps {
  target: string;
  eyebrow: string;
  line: string;
  step: 1 | 2 | 3;
  wait?: string;
  next?: { label: string; onClick: () => void };
  onEnd: () => void;
}

const Guided = ({ target, ...bubble }: GuidedProps) => {
  const { rect } = useTarget(target);
  return (
    <>
      <Spotlight rect={rect} />
      <TourBubble rect={rect} {...bubble} />
    </>
  );
};

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

const Chip = ({ children, onEnd }: { children: ReactNode; onEnd: () => void }) => (
  <div className="pointer-events-auto fixed bottom-20 left-1/2 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 bg-surface py-2 pl-2 pr-3 shadow-2xl md:bottom-4">
    <img src="/images/daisu/bust.webp" alt="" className="h-9 w-9 shrink-0 object-contain object-top" />
    {children}
    <button
      type="button"
      onClick={onEnd}
      className="h-10 whitespace-nowrap border-none bg-transparent px-1 text-xs font-semibold text-ink-faint hover:border-none hover:text-ink-soft"
    >
      {t("end")}
    </button>
  </div>
);

// no dim here: a round can need more of the page than one button. once play is pressed she steps
// aside to a chip, so the round is not played under her
const PlayStep = ({ eyebrow, onEnd }: { eyebrow: string; onEnd: () => void }) => {
  const { rect } = useTarget("play-button");
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const button = e.target instanceof Element ? e.target.closest("button") : null;
      if (button && !button.disabled && button.closest('[data-tour="play-button"]')) setPressed(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (pressed) {
    return (
      <Chip onEnd={onEnd}>
        <span className="text-sm font-semibold text-ink-soft">{t("playWatching")}</span>
      </Chip>
    );
  }
  return (
    <>
      <Spotlight rect={rect} dim={false} />
      <TourBubble rect={rect} eyebrow={eyebrow} line={t("playLine")} step={3} wait={t("playWait")} onEnd={onEnd} />
    </>
  );
};

const Welcome = ({ onStart, onDecline }: { onStart: () => void; onDecline: () => void }) => (
  <div className="pointer-events-auto fixed inset-0 flex items-end justify-center md:items-center" style={{ background: DIM }}>
    <div role="dialog" aria-label={t("welcomeTitle")} className="relative flex max-h-full w-full flex-col overflow-y-auto bg-surface shadow-2xl md:w-[640px] md:flex-row">
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
            <h2 className="m-0 text-2xl font-extrabold leading-tight md:text-[28px]">{t("welcomeTitle")}</h2>
          </div>
        </div>
        <p className="m-0 text-sm leading-relaxed text-ink-soft md:text-[15px]">{t("welcomeBody")}</p>
        <div className="grid grid-cols-3 gap-1.5 md:flex md:gap-2">
          {["chipPot", "chipCase", "chipGame"].map((key, i) => (
            <span key={key} className="flex h-8 items-center justify-center gap-2 bg-surface-nav px-3 text-xs font-semibold text-ink-soft">
              <b className="text-accent-gold">{i + 1}</b>
              {t(key)}
            </span>
          ))}
        </div>
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
  </div>
);

const GamePicker = ({ onPick, onEnd }: { onPick: (game: TourGameInfo) => void; onEnd: () => void }) => (
  <div className="pointer-events-auto fixed inset-0 flex items-end justify-center md:items-center" style={{ background: DIM }}>
    <div role="dialog" aria-label={t("titleGame")} className="flex max-h-full w-full flex-col overflow-y-auto bg-surface shadow-2xl md:w-[780px]">
      <div className="flex gap-3.5 px-5 pb-4 pt-5 md:px-6">
        <img src="/images/daisu/bust.webp" alt="" className="h-[54px] w-[54px] shrink-0 object-contain object-top" />
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{`${t("stepOf", { n: 3 })} · ${t("titleGame")}`}</span>
          <p className="m-0 text-sm leading-normal text-ink-soft">{t("gamesLine")}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 px-5 md:px-6">
        <span className="h-[3px] bg-accent-gold" />
        <span className="h-[3px] bg-accent-gold" />
        <span className="h-[3px] bg-accent-gold" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-5 pb-2 pt-4 md:grid-cols-4 md:px-6">
        {TOUR_GAMES.map((game) => (
          <button
            key={game.key}
            type="button"
            onClick={() => onPick(game)}
            className="group relative flex h-[132px] flex-col items-center justify-end gap-1.5 rounded-none border-none bg-surface-nav px-2 pb-3 pt-3 hover:border-none hover:bg-surface-raised"
          >
            <img src={game.art} alt="" className="block h-[70px] w-auto max-w-[110px] object-contain" />
            <b className="text-[13px] font-bold text-ink">{i18n.t(game.nameKey)}</b>
            <small className="text-[11px] text-ink-muted">{t(`games.${game.key}`)}</small>
            <span className="absolute inset-x-0 bottom-0 h-[3px] bg-accent-gold opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-3 md:px-6">
        <span className="text-xs text-ink-muted">{t("gamesNote")}</span>
        <button type="button" onClick={onEnd} className="h-11 border-none bg-transparent px-1 text-xs font-semibold text-ink-faint hover:border-none hover:text-ink-soft">
          {t("end")}
        </button>
      </div>
    </div>
  </div>
);

const doneLine = (result: GameResult | null) => {
  if (result && result.payout > result.wagered) return "doneWin";
  if (result && result.payout === result.wagered) return "doneEven";
  return "doneLose";
};

const DoneCard = ({ tour, onMissions, onLater }: { tour: TourState; onMissions: () => void; onLater: () => void }) => {
  const game = tourGame(tour.game);
  return (
    <div className="pointer-events-auto fixed inset-0 flex items-end justify-center md:items-center" style={{ background: DIM }}>
      <div role="dialog" aria-label={t("doneTitle")} className="flex max-h-full w-full flex-col overflow-y-auto bg-surface shadow-2xl md:w-[520px]">
        <div className="flex gap-4 px-5 pb-4 pt-6 md:px-6">
          <img src="/images/daisu/idle.webp" alt="" className="block h-32 w-auto shrink-0 md:h-[170px]" />
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">{t("doneTitle")}</span>
            <p className="m-0 text-sm leading-normal text-ink-soft">{t(doneLine(tour.result))}</p>
            <p className="m-0 text-sm leading-normal text-ink-soft">{t("doneOut")}</p>
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
    </div>
  );
};

// each step belongs to a page; away from it, the tour waits as a chip instead of pointing at nothing
const onRoute = (step: string, pathname: string, game: TourGameInfo | null) => {
  if (step === "case") return pathname === "/";
  if (step === "open" || step === "drop") return pathname.startsWith("/case/");
  if (step === "bet" || step === "play") return !!game && pathname === game.path;
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
  const tour = useTour();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [potTaken, setPotTaken] = useState(false);
  const game = tourGame(tour.game);
  const step = tour.status === "active" ? tour.step : null;

  useEffect(() => {
    if (!owner) return;
    syncTour(owner, serverStatus ? { status: serverStatus, step: serverStep } : null);
  }, [owner, serverStatus, serverStep]);

  // her card holds the jar, so the pot step opens it and waits for a take
  useEffect(() => {
    if (step !== "pot") return;
    setPotTaken(false);
    showDaisu("popup");
    const onTaken = () => setPotTaken(true);
    window.addEventListener(JAR_TAKEN_EVENT, onTaken);
    return () => window.removeEventListener(JAR_TAKEN_EVENT, onTaken);
  }, [step]);

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
    if ((step === "bet" || step === "play") && !game) goTo("game");
  }, [step, tour.drop, game]);

  // a round played before pressing next on the bet counts just the same
  useEffect(() => {
    if ((step !== "bet" && step !== "play") || !game) return;
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

  const phone = window.innerWidth < 768;
  const stepTitle = (n: number, title: string) => `${t("stepOf", { n })} · ${title}`;
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
    if ((step === "bet" || step === "play") && game) return navigate(game.path);
    toCases();
  };
  const dropLine = (drop: RevealedItem) => {
    const rarity = Math.min(5, Math.max(1, Math.round(Number(drop.rarity)) || 1));
    return t(`drop.${rarity}`, { item: drop.name, rarity: rarityName(rarity), value: kp(drop.sellValue ?? 0) });
  };

  let content: JSX.Element | null = null;
  if (tour.status === "offered") {
    content = <Welcome onStart={startTour} onDecline={endTour} />;
  } else if (step && !onRoute(step, pathname, game)) {
    content = (
      <Chip onEnd={endTour}>
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
    content = (
      <Guided
        target="daisu-jar"
        eyebrow={stepTitle(1, t("titlePot"))}
        line={t(potTaken ? "potTaken" : "potLine")}
        step={1}
        wait={potTaken ? undefined : t("potWait")}
        next={potTaken ? { label: t("next"), onClick: toCases } : undefined}
        onEnd={endTour}
      />
    );
  } else if (step === "case") {
    content = <Guided target={phone ? "case-card" : "case-shelf"} eyebrow={stepTitle(2, t("titleCase"))} line={t("caseLine")} step={2} wait={t("caseWait")} onEnd={endTour} />;
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
    content = <GamePicker onPick={pick} onEnd={endTour} />;
  } else if (step === "bet" && game) {
    content = (
      <Guided
        target="bet-input"
        eyebrow={stepTitle(3, i18n.t(game.nameKey))}
        line={t(`bet.${game.key}`)}
        step={3}
        next={{ label: t("next"), onClick: () => goTo("play") }}
        onEnd={endTour}
      />
    );
  } else if (step === "play" && game) {
    content = <PlayStep eyebrow={stepTitle(3, i18n.t(game.nameKey))} onEnd={endTour} />;
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
