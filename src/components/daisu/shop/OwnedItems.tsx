import { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import type { Shop } from "../../../services/daisu/ShopService";
import ShopArt from "./ShopArt";
import { itemWords, statusOf, Tip } from "./shopCopy";
import { xpBonusPct } from "../../../utils/levelCurve";
import i18n from "../../../i18n";

interface Props {
  shop: Shop | null;
  onPick: (key: string) => void;
}

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.shop.${key}`, vars);

// what is held, small, under her bonus: one wrapping row of pictures with the xp bonus they add up to, names on request
const OwnedItems = ({ shop, onPick }: Props) => {
  const [open, setOpen] = useState(false);
  const items = shop ? shop.items.filter((i) => i.owned) : [];
  if (!shop || !items.length) return null;
  const pct = xpBonusPct(shop.xpBoost);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("yourItems", { n: items.length })}</span>
        <span className="flex items-center gap-2">
          {pct > 0 && <span className="bg-surface-nav px-2 py-0.5 text-[11px] font-extrabold text-accent-gold">{t("xpBonus", { pct })}</span>}
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={t(open ? "collapse" : "expand")}
            className="flex h-6 w-6 items-center justify-center rounded-none border-none bg-transparent p-0 text-ink-muted hover:border-none hover:text-white focus:outline-none"
          >
            {open ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const words = itemWords(item);
          const status = statusOf(item, shop);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onPick(item.key)}
              aria-label={`${words.name}, ${status.tip}`}
              data-state="owned"
              className={`group relative flex shrink-0 items-center gap-1.5 rounded-none border-none bg-surface p-1 hover:border-none hover:bg-surface-hover focus:outline-none focus-visible:bg-surface-hover ${open ? "pr-2" : ""}`}
            >
              <ShopArt item={item.key} game={item.game} size={32} />
              {open && <span className="text-[11px] font-semibold text-ink-soft">{words.name}</span>}
              <Tip title={words.name} line={words.what} status={status.tip} tone={status.tone} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OwnedItems;
