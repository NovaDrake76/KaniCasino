import Skeleton from "react-loading-skeleton";
import { FiCheck } from "react-icons/fi";
import Monetary from "../../Monetary";
import type { Shop, ShopItem, UnlockKey } from "../../../services/daisu/ShopService";
import ShopArt from "./ShopArt";
import PixelIcon from "../PixelIcon";
import { kp } from "../potMath";
import i18n from "../../../i18n";

interface Props {
  shop: Shop | null;
  onPick: (key: UnlockKey) => void;
}

// empty places on the shelf, so it reads as something that will grow
const TEASERS = 2;
const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.shop.${key}`, vars);

const Tip = ({ title, line, status, tone }: { title: string; line: string; status: string; tone: string }) => (
  <span
    role="tooltip"
    className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-raised hidden w-60 -translate-x-1/2 flex-col gap-1 bg-surface-nav px-3.5 py-3 text-left shadow-2xl md:group-hover:flex md:group-focus-visible:flex"
  >
    <b className="text-sm text-ink">{title}</b>
    <span className="text-xs leading-snug text-ink-soft">{line}</span>
    <span className={`mt-1 text-xs font-bold ${tone}`}>{status}</span>
  </span>
);

const Slot = ({ item, shop, onPick }: { item: ShopItem; shop: Shop; onPick: (key: UnlockKey) => void }) => {
  const name = t(`items.${item.key}.name`);
  const tooLow = !item.owned && shop.level < item.level;
  const short = !item.owned && shop.walletBalance < item.price;
  const status = item.owned
    ? { foot: t("yours"), tip: item.via === "history" ? `${t("yours")} · ${t(`items.${item.key}.kept`)}` : t("yours"), tone: "text-green-400" }
    : tooLow
      ? { foot: t("level", { n: item.level }), tip: t("tipLevel", { n: item.level, level: shop.level }), tone: "text-accent-amber" }
      : short
        ? { foot: kp(item.price), tip: t("tipShort", { price: kp(item.price), amount: kp(item.price - shop.walletBalance) }), tone: "text-ink-muted" }
        : { foot: kp(item.price), tip: t("tipBuy", { price: kp(item.price), n: item.level }), tone: "text-accent-gold" };
  return (
    <button
      type="button"
      onClick={() => onPick(item.key)}
      aria-label={`${name}, ${status.tip}`}
      data-state={item.owned ? "owned" : tooLow ? "locked" : short ? "short" : "open"}
      className="group relative flex h-[88px] w-[76px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-none border-none bg-surface p-0 hover:border-none hover:bg-surface-hover focus:outline-none focus-visible:bg-surface-hover md:h-24 md:w-[84px]"
    >
      <span className={tooLow ? "opacity-35 grayscale" : ""}>
        <ShopArt item={item.key} size={48} />
      </span>
      <span className={`flex items-center gap-1 text-[11px] font-extrabold ${status.tone}`}>
        {item.owned && <FiCheck aria-hidden />}
        {status.foot}
      </span>
      {!item.owned && !tooLow && !short && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse bg-accent-gold" />}
      <Tip title={name} line={t(`items.${item.key}.what`)} status={status.tip} tone={status.tone} />
    </button>
  );
};

// her shop as a shelf over the missions: every item always in sight, a hover says what it is and a click opens its card
const ShopShelf = ({ shop, onPick }: Props) => (
  <div className="flex flex-col gap-2.5">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("title")}</span>
      {shop && (
        <span className="text-[13px] font-bold text-green-400">
          <Monetary value={shop.walletBalance} />
        </span>
      )}
    </div>
    <div className="flex gap-2.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
      {shop
        ? shop.items.map((item) => <Slot key={item.key} item={item} shop={shop} onPick={onPick} />)
        : [0, 1, 2, 3].map((i) => <Skeleton key={i} width={84} height={96} borderRadius={0} />)}
      {shop &&
        Array.from({ length: TEASERS }, (_, i) => (
          <span
            key={i}
            className="group relative flex h-[88px] w-[76px] shrink-0 items-center justify-center outline-dashed outline-2 -outline-offset-2 outline-line-strong md:h-24 md:w-[84px]"
          >
            <PixelIcon name="mystery" size={32} className="opacity-60" />
            <Tip title="???" line={t("soon")} status="" tone="" />
          </span>
        ))}
    </div>
  </div>
);

export default ShopShelf;
