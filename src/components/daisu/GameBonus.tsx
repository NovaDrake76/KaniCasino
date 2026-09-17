import useGameBonus from "./useGameBonus";
import BonusTicket from "./BonusTicket";
import { GAME_NAME_KEYS, clock, kpExact } from "./potMath";
import type { PickGame } from "../../services/daisu/DaisuService";
import i18n from "../../i18n";

// the strip above a game's bet: her bonus for this game as a ticket, with how long it has left
export const GameBonusStrip = ({ game, className }: { game: PickGame; className?: string }) => {
  const bonus = useGameBonus(game);
  if (!bonus) return null;
  return (
    <div data-tour="game-bonus" className={className}>
      <BonusTicket daisu small bonus={{ name: i18n.t(GAME_NAME_KEYS[game]), art: "", amount: bonus.amount, clock: clock(bonus.msLeft), left: bonus.left, expiring: bonus.expiring }} />
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
      {fromWallet > 0
        ? i18n.t("daisu.ticket.betSplit", { bonus: kpExact(fromBonus), wallet: kpExact(fromWallet) })
        : i18n.t("daisu.ticket.betAll", { bonus: kpExact(fromBonus) })}
    </span>
  );
};
