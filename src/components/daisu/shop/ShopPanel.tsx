import Skeleton from "react-loading-skeleton";
import { FiCheck, FiLock } from "react-icons/fi";
import Monetary from "../../Monetary";
import type { Shop, ShopItem, UnlockKey } from "../../../services/daisu/ShopService";
import ShopArt from "./ShopArt";
import i18n from "../../../i18n";

interface Props {
  shop: Shop | null;
  onPick: (key: UnlockKey) => void;
}

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.shop.${key}`, vars);

const Foot = ({ item, level, onPick }: { item: ShopItem; level: number; onPick: (key: UnlockKey) => void }) => {
  if (item.owned) {
    return (
      <div className="flex min-h-[36px] flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-green-400">
          <FiCheck className="text-sm" /> {t("yours")}
        </span>
        {item.via === "history" && <span className="text-[11px] text-ink-faint">{t(`items.${item.key}.kept`)}</span>}
      </div>
    );
  }
  const tooLow = level < item.level;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className={`text-base font-extrabold ${tooLow ? "text-ink-muted" : "text-accent-gold"}`}>
          <Monetary value={item.price} />
        </span>
        <span className={`bg-surface-raised px-2 py-[3px] text-[11px] font-bold ${tooLow ? "text-accent-amber" : "text-ink-soft"}`}>
          {t("level", { n: item.level })}
        </span>
      </div>
      {tooLow ? (
        <span className="flex h-11 w-24 items-center justify-center gap-1.5 rounded-md bg-surface-nav text-xs font-bold text-ink-faint md:h-9 md:w-[92px]">
          <FiLock /> {t("locked")}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onPick(item.key)}
          className="h-11 w-24 rounded-md border-none bg-accent text-sm font-bold text-white hover:border-none hover:bg-accent-light focus:outline-none md:h-9 md:w-[92px] md:text-[13px]"
        >
          {t("buy")}
        </button>
      )}
    </div>
  );
};

const ItemCard = ({ item, level, onPick }: { item: ShopItem; level: number; onPick: (key: UnlockKey) => void }) => {
  const tooLow = !item.owned && level < item.level;
  return (
    <div className="flex flex-col gap-3 bg-surface p-3.5 md:gap-3.5 md:p-4">
      <div className="flex gap-3 md:gap-3.5">
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center bg-surface-nav md:h-[68px] md:w-[68px] ${tooLow ? "opacity-50" : ""}`}>
          <ShopArt item={item.key} size={38} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className={`text-[15px] font-extrabold ${tooLow ? "text-ink-muted" : ""}`}>{t(`items.${item.key}.name`)}</span>
          <span className="text-xs leading-snug text-ink-muted">{t(`items.${item.key}.what`)}</span>
        </div>
      </div>
      <Foot item={item} level={level} onPick={onPick} />
    </div>
  );
};

// her room's shop tab: what she sells, what the player already has, and what their level still keeps shut
const ShopPanel = ({ shop, onPick }: Props) => {
  if (!shop) {
    return (
      <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={150} borderRadius={0} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-end justify-between gap-3 pt-1">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">{t("title")}</span>
          <span className="text-[13px] text-ink-soft">{t("subtitle")}</span>
        </div>
        <span className="shrink-0 bg-surface-nav px-3 py-1.5 text-[13px] font-bold text-green-400">
          <Monetary value={shop.walletBalance} />
        </span>
      </div>
      <div className="grid gap-2.5 md:grid-cols-2 md:gap-3">
        {shop.items.map((item) => (
          <ItemCard key={item.key} item={item} level={shop.level} onPick={onPick} />
        ))}
      </div>
    </div>
  );
};

export default ShopPanel;
