import BonusTicket from "./BonusTicket";
import type { BonusView } from "./Daisu.types";
import i18n from "../../i18n";

interface Props {
  bonuses: BonusView[];
  // the game her next bonus goes to, and its share of a take
  pick: { name: string; art?: string };
  sharePct: number;
  onGo?: () => void;
}

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.ticket.${key}`, vars);

// her room's bonus: the live tickets, or an empty one saying how to get the next
const YourBonus = ({ bonuses, pick, sharePct, onGo }: Props) => {
  const [first, ...rest] = bonuses.filter((b) => !b.expired);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("yours")}</span>
      {first ? (
        <>
          <BonusTicket bonus={first} onGo={onGo} />
          {rest.map((b) => (
            <BonusTicket key={b.key} bonus={b} small onGo={onGo} />
          ))}
          <span className="text-[11px] leading-snug text-ink-muted">{t("source", { share: sharePct })}</span>
        </>
      ) : (
        <div className="grid items-center outline-dashed outline-2 -outline-offset-2 outline-line-strong" style={{ gridTemplateColumns: "64px minmax(0, 1fr)" }}>
          <span className="flex items-center justify-center self-stretch border-r-2 border-dashed border-line-strong p-2 opacity-40">
            {pick.art && <img src={pick.art} alt="" className="h-[44px] w-9 object-contain" />}
          </span>
          <span className="px-3 py-3 text-[12.5px] leading-snug text-ink-soft">{t("none", { share: sharePct, game: pick.name })}</span>
        </div>
      )}
    </div>
  );
};

export default YourBonus;
