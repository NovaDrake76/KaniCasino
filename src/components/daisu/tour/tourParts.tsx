import { useEffect, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { FiChevronsLeft, FiChevronsRight } from "react-icons/fi";
import TourBubble from "./TourBubble";
import { Rect, useTarget } from "./useTarget";
import { TOUR_GAMES, TourGameInfo } from "./tourGames";
import { getCases } from "../../../services/cases/CaseServices";
import { CaseLite, cheapestPerCategory } from "./tourCases";
import Monetary from "../../Monetary";
import i18n from "../../../i18n";
import TypedText from "../TypedText";

// light enough that the page still reads under it: at three quarters black a player lost where they were
const DIM = "rgba(9, 7, 20, 0.5)";
const PAD = 6;
const t = (key: string) => i18n.t(`daisu.tour.${key}`);

// the outline around what she points at. bold is for a player who keeps missing it. dimmed, four panels cover everything
// but the hole, the target unless something around it is given, so only that stays clickable: her tour dims, a mission's help does not
export const Spotlight = ({ rect, hole, dim = false, bold = false }: { rect: Rect | null; hole?: Rect | null; dim?: boolean; bold?: boolean }) => {
  if (!rect) return null;
  const pad = bold ? PAD + 4 : PAD;
  const top = rect.top - pad;
  const left = rect.left - pad;
  const width = rect.width + pad * 2;
  const height = rect.height + pad * 2;
  const outline = (
    <>
      <div
        className="pointer-events-none fixed"
        style={{
          top,
          left,
          width,
          height,
          outline: `${bold ? 5 : 2}px solid #FFCC00`,
          boxShadow: `0 0 36px ${bold ? 16 : 10}px rgba(255, 204, 0, ${bold ? 0.45 : 0.28})`,
        }}
      />
      {bold && (
        <>
          <FiChevronsRight aria-hidden className="pointer-events-none fixed text-4xl text-accent-gold drop-shadow" style={{ top: top + height / 2 - 18, left: left - 46 }} />
          <FiChevronsLeft aria-hidden className="pointer-events-none fixed text-4xl text-accent-gold drop-shadow" style={{ top: top + height / 2 - 18, left: left + width + 10 }} />
        </>
      )}
    </>
  );
  if (!dim) return outline;
  const open = hole ?? { top, left, width, height };
  return (
    <>
      <div className="pointer-events-auto fixed inset-x-0 top-0" style={{ height: Math.max(0, open.top), background: DIM }} />
      <div className="pointer-events-auto fixed inset-x-0 bottom-0" style={{ top: open.top + open.height, background: DIM }} />
      <div className="pointer-events-auto fixed left-0" style={{ top: open.top, height: open.height, width: Math.max(0, open.left), background: DIM }} />
      <div className="pointer-events-auto fixed right-0" style={{ top: open.top, height: open.height, left: open.left + open.width, background: DIM }} />
      {outline}
    </>
  );
};

// the dim behind a card: the card sits at the bottom of a phone and in the middle of anything wider
export const Backdrop = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-auto fixed inset-0 flex items-end justify-center md:items-center" style={{ background: DIM }}>
    {children}
  </div>
);

// anchor is something bigger around the target, like her whole card around the jar: her words go beside it, never over it,
// and a dim leaves all of it clickable, so she can still be poked while she asks for the jar
type GuidedProps = Omit<ComponentProps<typeof TourBubble>, "rect"> & { target: string; anchor?: string; dim?: boolean; bold?: boolean };

export const Guided = ({ target, anchor, dim = false, bold = false, ...bubble }: GuidedProps) => {
  const { rect } = useTarget(target);
  const around = useTarget(anchor ?? null);
  return (
    <>
      <Spotlight rect={rect} hole={around.rect} dim={dim} bold={bold} />
      <TourBubble rect={around.rect ?? rect} {...bubble} />
    </>
  );
};

export const Chip = ({ children, endLabel, onEnd }: { children: ReactNode; endLabel: string; onEnd: () => void }) => (
  <div className="pointer-events-auto fixed bottom-20 left-1/2 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 bg-surface py-2 pl-2 pr-3 shadow-2xl md:bottom-4">
    <img src="/images/daisu/bust.webp" alt="" className="h-9 w-9 shrink-0 object-contain object-top" />
    {children}
    <button
      type="button"
      onClick={onEnd}
      className="h-10 whitespace-nowrap border-none bg-transparent px-1 text-xs font-semibold text-ink-faint hover:border-none hover:text-ink-soft focus:outline-none"
    >
      {endLabel}
    </button>
  </div>
);

interface PlayProps {
  eyebrow: string;
  line: string;
  step?: 3;
  endLabel: string;
  onEnd: () => void;
}

// no dim here: a round can need more of the page than one button. once play is pressed she steps
// aside to a chip, so the round is not played under her
export const PlayStep = ({ eyebrow, line, step, endLabel, onEnd }: PlayProps) => {
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
      <Chip endLabel={endLabel} onEnd={onEnd}>
        <span className="text-sm font-semibold text-ink-soft">{t("playWatching")}</span>
      </Chip>
    );
  }
  return (
    <>
      <Spotlight rect={rect} dim={false} />
      <TourBubble rect={rect} eyebrow={eyebrow} line={line} step={step} wait={t("playWait")} endLabel={endLabel} onEnd={onEnd} />
    </>
  );
};

interface PickerProps {
  eyebrow: string;
  line: string;
  // the tour's last step fills its bar here; a mission's help has no steps to count
  step?: 3;
  endLabel: string;
  onPick: (game: TourGameInfo) => void;
  onEnd: () => void;
}

export const GamePicker = ({ eyebrow, line, step, endLabel, onPick, onEnd }: PickerProps) => (
  <Backdrop>
    <div role="dialog" aria-label={eyebrow} className="flex max-h-full w-full flex-col overflow-y-auto bg-surface shadow-2xl md:w-[780px]">
      <div className="flex gap-3.5 px-5 pb-4 pt-5 md:px-6">
        <img src="/images/daisu/bust.webp" alt="" className="h-[54px] w-[54px] shrink-0 object-contain object-top" />
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{eyebrow}</span>
          <p className="m-0 text-sm leading-normal text-ink-soft">
            <TypedText text={line} />
          </p>
        </div>
      </div>
      {step && (
        <div className="grid grid-cols-3 gap-1 px-5 md:px-6">
          <span className="h-[3px] bg-accent-gold" />
          <span className="h-[3px] bg-accent-gold" />
          <span className="h-[3px] bg-accent-gold" />
        </div>
      )}
      <div className={`grid grid-cols-2 gap-2.5 px-5 pb-2 md:grid-cols-4 md:px-6 ${step ? "pt-4" : "pt-1"}`}>
        {TOUR_GAMES.map((game) => (
          <button
            key={game.key}
            type="button"
            onClick={() => onPick(game)}
            className="group relative flex h-[132px] flex-col items-center justify-end gap-1.5 rounded-none border-none bg-surface-nav px-2 pb-3 pt-3 hover:border-none hover:bg-surface-raised focus:outline-none"
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
        <button
          type="button"
          onClick={onEnd}
          className="h-11 shrink-0 whitespace-nowrap border-none bg-transparent px-1 text-xs font-semibold text-ink-faint hover:border-none hover:text-ink-soft focus:outline-none"
        >
          {endLabel}
        </button>
      </div>
    </div>
  </Backdrop>
);

interface CasePickerProps {
  eyebrow: string;
  line: string;
  endLabel: string;
  onPick: (id: string) => void;
  onEnd: () => void;
}

export const CasePicker = ({ eyebrow, line, endLabel, onPick, onEnd }: CasePickerProps) => {
  const [cases, setCases] = useState<CaseLite[] | null>(null);

  useEffect(() => {
    let live = true;
    getCases()
      .then((list: CaseLite[]) => live && setCases(cheapestPerCategory(Array.isArray(list) ? list : [])))
      .catch(() => live && setCases([]));
    return () => {
      live = false;
    };
  }, []);

  return (
    <Backdrop>
      <div role="dialog" aria-label={eyebrow} className="flex max-h-full w-full flex-col overflow-y-auto bg-surface shadow-2xl md:w-[780px]">
        <div className="flex gap-3.5 px-5 pb-4 pt-5 md:px-6">
          <img src="/images/daisu/bust.webp" alt="" className="h-[54px] w-[54px] shrink-0 object-contain object-top" />
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{eyebrow}</span>
            <p className="m-0 text-sm leading-normal text-ink-soft">
              <TypedText text={line} />
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 px-5 md:px-6">
          <span className="h-[3px] bg-accent-gold" />
          <span className="h-[3px] bg-accent-gold" />
          <span className="h-[3px] bg-surface-nav" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 px-5 pb-2 pt-4 md:grid-cols-5 md:px-6">
          {cases === null
            ? [0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[150px] animate-pulse bg-surface-nav" />)
            : cases.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => onPick(c._id)}
                  className="group relative flex h-[150px] flex-col items-center justify-end gap-1 rounded-none border-none bg-surface-nav px-2 pb-3 pt-2 hover:border-none hover:bg-surface-raised focus:outline-none"
                >
                  <img src={c.image} alt="" className="block h-[72px] w-auto max-w-[110px] object-contain" />
                  <b className="line-clamp-1 text-[13px] font-bold text-ink">{c.title}</b>
                  <small className="text-[11px] text-ink-muted">{c.category}</small>
                  <span className="text-xs font-bold text-accent-gold">
                    <Monetary value={c.price} />
                  </span>
                  <span className="absolute inset-x-0 bottom-0 h-[3px] bg-accent-gold opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 pb-5 pt-3 md:px-6">
          <button
            type="button"
            onClick={onEnd}
            className="h-11 shrink-0 whitespace-nowrap border-none bg-transparent px-1 text-xs font-semibold text-ink-faint hover:border-none hover:text-ink-soft focus:outline-none"
          >
            {endLabel}
          </button>
        </div>
      </div>
    </Backdrop>
  );
};
