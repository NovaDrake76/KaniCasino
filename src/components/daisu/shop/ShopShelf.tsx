import { useEffect, useRef, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { FiChevronDown, FiChevronUp, FiLock } from "react-icons/fi";
import Monetary from "../../Monetary";
import type { Shop, ShopItem } from "../../../services/daisu/ShopService";
import ShopArt from "./ShopArt";
import PixelIcon from "../PixelIcon";
import { itemWords, statusOf, Tip } from "./shopCopy";
import i18n from "../../../i18n";

interface Props {
  shop: Shop | null;
  onPick: (key: string) => void;
}

// at most this many "?" places stand in for the items still hidden, so the shelf hints at more without saying how much
const TEASERS = 2;
// one row of slots, in pixels, for the shelf folded on a wide screen
const ROW_PX = 96;
const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.shop.${key}`, vars);

const Slot = ({ item, shop, onPick }: { item: ShopItem; shop: Shop; onPick: (key: string) => void }) => {
  const words = itemWords(item);
  const status = statusOf(item, shop);
  return (
    <button
      type="button"
      onClick={() => onPick(item.key)}
      aria-label={`${words.name}, ${status.tip}`}
      data-state={status.state}
      className="group relative flex h-[88px] w-[76px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-none border-none bg-surface p-0 hover:border-none hover:bg-surface-hover focus:outline-none focus-visible:bg-surface-hover md:h-24 md:w-[84px]"
    >
      <span className={status.state === "locked" ? "opacity-35 grayscale" : ""}>
        <ShopArt item={item.key} game={item.game} size={48} />
      </span>
      <span className={`flex items-center gap-1 text-[11px] font-extrabold ${status.tone}`}>
        {status.state === "locked" && <FiLock aria-hidden />}
        {status.foot}
      </span>
      {status.state === "open" && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse bg-accent-gold" />}
      <Tip title={words.name} line={words.what} status={status.tip} tone={status.tone} />
    </button>
  );
};

// her shop as one shelf over the missions: what is still for sale in level order, whatever its kind, and a "?" or two for what
// buying reveals. on a wide screen the shelf folds to one row and opens only when there is more than a row holds
const ShopShelf = ({ shop, onPick }: Props) => {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const row = useRef<HTMLDivElement | null>(null);
  const forSale = shop ? shop.items.filter((i) => !i.owned) : [];
  const teasers = shop ? Math.min(TEASERS, shop.hidden ?? 0) : 0;

  useEffect(() => {
    const el = row.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const check = () => setOverflows(el.scrollHeight > ROW_PX + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [forSale.length, teasers]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("title")}</span>
        {shop && (
          <span className="text-[13px] font-bold text-green-400">
            <Monetary value={shop.walletBalance} />
          </span>
        )}
      </div>
      <div className="flex items-start gap-2">
        <div
          ref={row}
          className={`flex min-w-0 flex-1 gap-2.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-x-visible md:pb-0 ${open ? "" : "md:overflow-y-hidden"}`}
          style={open ? undefined : { maxHeight: ROW_PX }}
        >
          {shop
            ? forSale.map((item) => <Slot key={item.key} item={item} shop={shop} onPick={onPick} />)
            : [0, 1, 2, 3].map((i) => <Skeleton key={i} width={84} height={96} borderRadius={0} />)}
          {Array.from({ length: teasers }, (_, i) => (
            <span
              key={i}
              className="group relative flex h-[88px] w-[76px] shrink-0 items-center justify-center outline-dashed outline-2 -outline-offset-2 outline-line-strong md:h-24 md:w-[84px]"
            >
              <PixelIcon name="mystery" size={32} className="opacity-60" />
              <Tip title="???" line={t("soon")} status="" tone="" />
            </span>
          ))}
        </div>
        {overflows && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={t(open ? "showLess" : "showAll")}
            className="hidden h-24 w-8 shrink-0 items-center justify-center rounded-none border-none bg-surface p-0 text-ink-muted hover:border-none hover:bg-surface-hover hover:text-white focus:outline-none md:flex"
          >
            {open ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        )}
      </div>
    </div>
  );
};

export default ShopShelf;
