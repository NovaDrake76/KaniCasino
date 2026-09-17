import { Link } from "react-router-dom";
import { FiClock } from "react-icons/fi";
import Monetary from "../Monetary";
import type { BonusView } from "./Daisu.types";
import i18n from "../../i18n";

interface Props {
  bonus: Pick<BonusView, "name" | "art" | "amount" | "clock" | "left" | "expiring"> & { path?: string };
  // the one-line ticket of her card and the games; the full one carries its explanation and a play button
  small?: boolean;
  // her face instead of the game's art, for the strip inside that game
  daisu?: boolean;
  // her room covers the page, so following a ticket out of it has to close it
  onGo?: () => void;
  className?: string;
}

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.ticket.${key}`, vars);

// a bonus drawn as a ticket: what game it is for, how much it holds and how long it lasts
const BonusTicket = ({ bonus, small, daisu, onGo, className }: Props) => {
  const stub = small ? 44 : 64;
  const art = daisu ? "/images/daisu/bust.webp" : bonus.art;
  const body = (
    <>
      <span className="flex items-center justify-center self-stretch border-r-2 border-dashed border-black/40 p-1.5">
        <img src={art} alt="" className={`object-contain ${daisu ? "object-top" : ""} ${small ? "h-8 w-7" : "h-[52px] w-10"}`} />
      </span>
      <span className={`flex min-w-0 flex-col gap-px ${small ? "px-2.5 py-1.5" : "px-3 py-2.5"}`}>
        <span className="truncate text-[10.5px] font-bold uppercase tracking-wider text-accent-gold">{t("kicker", { game: bonus.name })}</span>
        <span className={`font-extrabold leading-tight ${small ? "text-[15px]" : "text-[21px]"}`}>
          <Monetary value={Math.floor(bonus.amount)} />{" "}
          <small className="text-[11px] font-semibold text-ink-soft">{daisu ? t("spentFirst") : small ? "" : t("forGame", { game: bonus.name })}</small>
        </span>
        {!small && (
          <span className={`text-[11.5px] leading-snug ${bonus.expiring ? "text-accent-amber" : "text-ink-muted"}`}>
            {bonus.expiring ? i18n.t("daisu.bonusHurry") : t("spends", { game: bonus.name })}
          </span>
        )}
      </span>
      <span className={`flex items-end gap-1.5 pr-3 ${small ? "flex-row items-center" : "flex-col py-2.5"}`}>
        <span className={`flex items-center gap-1 text-xs font-semibold tabular-nums ${bonus.expiring ? "text-accent-amber" : "text-ink-soft"}`}>
          <FiClock aria-hidden />
          {bonus.clock}
        </span>
        {!small && bonus.path && (
          <Link to={bonus.path} onClick={onGo} className="bg-accent px-3.5 py-2 text-[13px] font-bold text-white hover:bg-[#4338CA] hover:text-white">
            {i18n.t("daisu.play")}
          </Link>
        )}
      </span>
      <span className="absolute bottom-0 right-0 h-[3px] bg-surface-nav" style={{ left: stub }}>
        <span
          className={`daisu-fill block h-full ${bonus.expiring ? "bg-accent-amber" : "bg-accent-gold"}`}
          style={{ width: `${Math.round(bonus.left * 100)}%` }}
        />
      </span>
    </>
  );
  const shape = `daisu-ticket relative grid items-center overflow-hidden bg-surface-raised text-left text-ink ${className || ""}`;
  const style = { gridTemplateColumns: `${stub}px minmax(0, 1fr) auto`, ["--stub" as string]: `${stub}px` };
  if (small && bonus.path) {
    return (
      <Link to={bonus.path} onClick={onGo} className={`${shape} hover:bg-surface-hover hover:text-ink`} style={style}>
        {body}
      </Link>
    );
  }
  return (
    <div className={shape} style={style}>
      {body}
    </div>
  );
};

export default BonusTicket;
