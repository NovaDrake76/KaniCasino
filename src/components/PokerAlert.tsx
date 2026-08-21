import { Link } from "react-router-dom";
import Monetary from "./Monetary";
import { rarityColor } from "../utils/rarity";
import i18n from "../i18n";

export interface OnTheLine {
  tableId: string;
  tableName: string;
  slug: string;
  item: { name: string; image: string; rarity: string; value: number };
  from: string | null;
  chasedBy: string | null;
}

// a legendary going out of its owner's reach is the one poker event worth telling the whole
// site about, and it is an invitation rather than a result: it is still winnable right now.
const PokerAlert = ({ alert }: { alert: OnTheLine }) => {
  const color = rarityColor(alert.item.rarity);
  return (
    <Link to={`/poker/${alert.slug}`} className="flex items-center gap-3">
      <img src={alert.item.image} alt="" className="h-10 w-10 shrink-0 object-contain" />
      <div className="min-w-0">
        <div className="text-sm font-bold" style={{ color }}>
          {i18n.t("poker.tickerOnTheLine", { name: alert.item.name })}
        </div>
        <div className="text-xs text-[#C9C6DE]">
          {alert.from
            ? i18n.t("poker.tickerFrom", { name: alert.from, table: alert.tableName })
            : alert.tableName}
        </div>
        <div className="text-[11px] text-[#84819A]">
          <Monetary value={alert.item.value} /> · {i18n.t("poker.tickerGoTake")}
        </div>
      </div>
    </Link>
  );
};

export default PokerAlert;
