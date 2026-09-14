import { FiClock } from "react-icons/fi";
import Monetary from "../Monetary";
import useGameBonus from "./useGameBonus";
import { clock, kpExact } from "./potMath";
import type { PickGame } from "../../services/daisu/DaisuService";
import i18n from "../../i18n";

// the strip above a game's bet: what daisu's bonus holds for this game and how long it has left
export const GameBonusStrip = ({ game, className }: { game: PickGame; className?: string }) => {
  const bonus = useGameBonus(game);
  if (!bonus) return null;

  return (
    <div data-tour="game-bonus" className={`relative flex items-center gap-2.5 overflow-hidden rounded bg-surface-raised px-2.5 pb-2.5 pt-2 text-left ${className || ""}`}>
      <img src="/images/daisu/bust.webp" alt="" className="h-8 w-8 shrink-0 object-contain object-top" />
      <div className="flex min-w-0 flex-grow flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{i18n.t("daisu.bonusTitle")}</span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-sm font-extrabold text-accent-gold">
            <Monetary value={Math.floor(bonus.amount)} />
          </span>
          <span className="text-xs text-ink-soft">{i18n.t("daisu.bonusPaysFirst")}</span>
        </span>
      </div>
      <span className={`flex items-center gap-1 text-xs font-semibold tabular-nums ${bonus.expiring ? "text-accent-amber" : "text-ink-soft"}`}>
        <FiClock aria-hidden />
        {clock(bonus.msLeft)}
      </span>
      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-surface-nav">
        <span
          className={`block h-full ${bonus.expiring ? "bg-accent-amber" : "bg-accent-gold"}`}
          style={{ width: `${Math.round(bonus.left * 100)}%` }}
        />
      </span>
    </div>
  );
};

// the line under the bet field saying where a stake comes from while a bonus pays for it
export const BonusBetHint = ({ game, bet, className = "text-ink-muted" }: { game: PickGame; bet: number; className?: string }) => {
  const bonus = useGameBonus(game);
  if (!bonus || bet <= 0) return null;
  const fromBonus = Math.min(bonus.amount, bet);
  const fromWallet = Math.round((bet - fromBonus) * 100) / 100;

  return (
    <span className={`text-xs ${className}`}>
      {fromWallet > 0 ? (
        i18n.t("daisu.bonusSplit", { bonus: kpExact(fromBonus), wallet: kpExact(fromWallet) })
      ) : (
        <>
          {i18n.t("daisu.bonusPaysAll")} <span className="font-semibold text-accent-gold">{kpExact(fromBonus)}</span>
        </>
      )}
    </span>
  );
};
