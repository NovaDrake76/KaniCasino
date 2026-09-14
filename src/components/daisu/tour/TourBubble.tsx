import { useLayoutEffect, useRef, useState } from "react";
import type { Rect } from "./useTarget";
import i18n from "../../../i18n";

interface Props {
  rect: Rect | null;
  eyebrow: string;
  line: string;
  step: 1 | 2 | 3;
  wait?: string;
  next?: { label: string; onClick: () => void };
  onEnd: () => void;
}

const WIDTH = 380;
const GAP = 16;
const EDGE = 12;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// beside what it points at, else below or above it; with nothing to point at yet, low and centered
const placement = (rect: Rect | null, height: number) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect) return { left: (vw - WIDTH) / 2, top: vh - height - 32 };
  const beside = clamp(rect.top + rect.height / 2 - height / 2, EDGE, vh - height - EDGE);
  if (rect.left + rect.width + GAP + WIDTH <= vw - EDGE) return { left: rect.left + rect.width + GAP, top: beside };
  if (rect.left - GAP - WIDTH >= EDGE) return { left: rect.left - GAP - WIDTH, top: beside };
  const left = clamp(rect.left + rect.width / 2 - WIDTH / 2, EDGE, vw - WIDTH - EDGE);
  if (rect.top + rect.height + GAP + height <= vh - EDGE) return { left, top: rect.top + rect.height + GAP };
  return { left, top: Math.max(EDGE, rect.top - GAP - height) };
};

// what she says at a step. on a phone it is a sheet on the half of the screen away from the target
const TourBubble = ({ rect, eyebrow, line, step, wait, next, onEnd }: Props) => {
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(180);
  const phone = window.innerWidth < 768;

  useLayoutEffect(() => {
    if (box.current) setHeight(box.current.offsetHeight);
  }, [line, wait, next, phone]);

  const sheetTop = !!rect && rect.top + rect.height / 2 > window.innerHeight / 2;

  return (
    <div
      ref={box}
      role="dialog"
      aria-label={eyebrow}
      className={`pointer-events-auto fixed flex flex-col bg-surface shadow-2xl ${phone ? `inset-x-0 ${sheetTop ? "top-0" : "bottom-0"}` : ""}`}
      style={phone ? undefined : { ...placement(rect, height), width: WIDTH }}
    >
      <div className="flex gap-3 px-[18px] pb-3 pt-4">
        <img src="/images/daisu/bust.webp" alt="" className="h-[46px] w-[46px] shrink-0 object-contain object-top" />
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{eyebrow}</span>
          <p className="m-0 text-sm leading-normal text-ink-soft">{line}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 px-[18px]">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-[3px] ${n <= step ? "bg-accent-gold" : "bg-surface-nav"}`} />
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 px-[18px] pb-3.5 pt-3">
        {next ? (
          <button
            type="button"
            onClick={next.onClick}
            className="h-11 rounded-md border-none bg-accent px-5 text-sm font-bold text-white hover:border-none hover:bg-accent-light md:h-10"
          >
            {next.label}
          </button>
        ) : wait ? (
          <span className="flex items-center gap-2 text-xs font-bold text-accent-amber">
            <span className="h-2 w-2 animate-pulse bg-accent-amber" />
            {wait}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onEnd}
          className="h-11 border-none bg-transparent px-1 text-xs font-semibold text-ink-faint hover:border-none hover:text-ink-soft md:h-10"
        >
          {i18n.t("daisu.tour.end")}
        </button>
      </div>
    </div>
  );
};

export default TourBubble;
