import { Link } from "react-router-dom";
import { FiClock } from "react-icons/fi";
import Monetary from "../Monetary";
import type { BonusView } from "./Daisu.types";
import i18n from "../../i18n";

const Countdown = ({ bonus, className }: { bonus: BonusView; className?: string }) => (
  <span className={`flex items-center gap-1 tabular-nums ${bonus.expiring ? "text-accent-amber" : ""} ${className || ""}`}>
    <FiClock aria-hidden />
    {bonus.clock}
  </span>
);

const Bar = ({ bonus, thick }: { bonus: BonusView; thick?: boolean }) => (
  <span className={`absolute inset-x-0 bottom-0 ${thick ? "h-[3px] bg-surface-nav" : "h-0.5 bg-surface-page"}`}>
    <span
      className={`daisu-fill block h-full ${bonus.expiring ? "bg-accent-amber" : thick ? "bg-accent-gold" : "bg-ink-muted"}`}
      style={{ width: `${Math.round(bonus.left * 100)}%` }}
    />
  </span>
);

const PickCard = ({ bonus }: { bonus: BonusView }) => (
  <div className={`relative flex items-center gap-3 overflow-hidden px-3 pb-[13px] pt-2.5 ${bonus.expiring ? "bg-[#402E3C]" : "bg-surface-raised"}`}>
    <img src={bonus.art} alt="" className="h-[54px] w-10 shrink-0 object-contain" />
    <div className="flex min-w-0 flex-grow flex-col gap-0.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-bold">{bonus.name}</span>
        <Countdown bonus={bonus} className={`text-xs ${bonus.expiring ? "font-bold" : "font-semibold text-ink-soft"}`} />
      </div>
      <span className="text-xl font-extrabold leading-tight text-accent-gold">
        <Monetary value={Math.floor(bonus.amount)} />
      </span>
      <span className={`text-[11px] leading-snug ${bonus.expiring ? "text-accent-amber" : "text-ink-muted"}`}>
        {bonus.expiring ? i18n.t("daisu.bonusHurry") : i18n.t("daisu.bonusUsedOn", { game: bonus.name })}
      </span>
    </div>
    <Link to={bonus.path} className="shrink-0 bg-accent px-3.5 py-2 text-[13px] font-bold text-white hover:bg-[#4338CA] hover:text-white">
      {i18n.t("daisu.play")}
    </Link>
    <Bar bonus={bonus} thick />
  </div>
);

const OlderRow = ({ bonus }: { bonus: BonusView }) => (
  <Link
    to={bonus.path}
    className="relative flex items-center gap-2.5 overflow-hidden bg-surface-nav px-3 pb-2 pt-1.5 text-ink hover:bg-surface-hover hover:text-ink"
  >
    <img src={bonus.art} alt="" className="h-[27px] w-5 shrink-0 object-contain" />
    <span className="flex-grow truncate text-[13px] font-semibold">{bonus.name}</span>
    <span className="text-[13px] font-bold text-accent-gold">
      <Monetary value={Math.floor(bonus.amount)} />
    </span>
    <Countdown bonus={bonus} className={`w-12 justify-end text-[11px] ${bonus.expiring ? "" : "text-ink-muted"}`} />
    <Bar bonus={bonus} />
  </Link>
);

const ExpiredRow = ({ bonus }: { bonus: BonusView }) => (
  <div className="flex items-center gap-3 bg-surface-nav px-3 py-2.5">
    <img src={bonus.art} alt="" className="h-[54px] w-10 shrink-0 object-contain opacity-30 grayscale" />
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[13px] font-bold text-ink-muted">{i18n.t("daisu.bonusExpired", { game: bonus.name })}</span>
      <span className="text-base font-bold text-ink-faint line-through">
        <Monetary value={Math.floor(bonus.amount)} />
      </span>
      <span className="text-[11px] text-ink-muted">{i18n.t("daisu.bonusNewOne")}</span>
    </div>
  </div>
);

// the freshest bonus as a card with its clock, older ones still ticking as a line each, and once
// every one has run out, the last as a receipt until the next take
const BonusSection = ({ bonuses }: { bonuses: BonusView[] }) => {
  const live = bonuses.filter((b) => !b.expired);
  const receipt = live.length ? null : bonuses.find((b) => b.expired);
  if (!live.length && !receipt) return null;
  const [pick, ...older] = live;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{i18n.t("daisu.bonusTitle")}</span>
        <span className="text-[11px] text-ink-faint">{i18n.t("daisu.bonusSpentFirst")}</span>
      </div>
      {pick && <PickCard bonus={pick} />}
      {older.map((b) => (
        <OlderRow key={b.key} bonus={b} />
      ))}
      {receipt && <ExpiredRow bonus={receipt} />}
    </div>
  );
};

export default BonusSection;
