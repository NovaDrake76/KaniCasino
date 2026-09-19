import { useState } from "react";
import Skeleton from "react-loading-skeleton";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import Monetary from "../../Monetary";
import type { ItemKind, Shop, ShopItem } from "../../../services/daisu/ShopService";
import ShopArt from "./ShopArt";
import PixelIcon from "../PixelIcon";
import { itemWords } from "./shopCopy";
import { kp } from "../potMath";
import { xpBonusPct } from "../../../utils/levelCurve";
import i18n from "../../../i18n";

interface Props {
  shop: Shop | null;
  onPick: (key: string) => void;
}

// at most this many "?" places stand in for the items still hidden on a ladder, so a row hints at more without saying how much
const TEASERS = 2;
const ROWS: ItemKind[] = ["boost", "charm", "unlock"];
const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.shop.${key}`, vars);

const Tip = ({ title, line, status, tone }: { title: string; line: string; status: string; tone: string }) => (
  <span
    role="tooltip"
    className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-raised hidden w-60 -translate-x-1/2 flex-col gap-1 bg-surface-nav px-3.5 py-3 text-left shadow-2xl md:group-hover:flex md:group-focus-visible:flex"
  >
    <b className="text-sm text-ink">{title}</b>
    <span className="text-xs leading-snug text-ink-soft">{line}</span>
    {status && <span className={`mt-1 text-xs font-bold ${tone}`}>{status}</span>}
  </span>
);

const statusOf = (item: ShopItem, shop: Shop) => {
  const tooLow = !item.owned && shop.level < item.level;
  const short = !item.owned && shop.walletBalance < item.price;
  if (item.owned) {
    const kept = item.via === "history" ? `${t("yours")} · ${t(`items.${item.key}.kept`)}` : t("yours");
    return { state: "owned", foot: t("yours"), tip: kept, tone: "text-green-400" };
  }
  if (tooLow) return { state: "locked", foot: t("level", { n: item.level }), tip: t("tipLevel", { n: item.level, level: shop.level }), tone: "text-accent-amber" };
  if (short) return { state: "short", foot: kp(item.price), tip: t("tipShort", { price: kp(item.price), amount: kp(item.price - shop.walletBalance) }), tone: "text-ink-muted" };
  return { state: "open", foot: kp(item.price), tip: t("tipBuy", { price: kp(item.price), n: item.level }), tone: "text-accent-gold" };
};

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
      <span className={`flex items-center gap-1 text-[11px] font-extrabold ${status.tone}`}>{status.foot}</span>
      {status.state === "open" && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 animate-pulse bg-accent-gold" />}
      <Tip title={words.name} line={words.what} status={status.tip} tone={status.tone} />
    </button>
  );
};

// what is held, small: one wrapping row of pictures with the xp bonus they add up to, names on request
const OwnedStrip = ({ items, shop, onPick }: { items: ShopItem[]; shop: Shop; onPick: (key: string) => void }) => {
  const [open, setOpen] = useState(false);
  const pct = xpBonusPct(shop.xpBoost);
  return (
    <div className="flex flex-col gap-2 bg-surface px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t("yourItems", { n: items.length })}</span>
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
              className={`group relative flex shrink-0 items-center gap-1.5 rounded-none border-none bg-surface-nav p-1 hover:border-none hover:bg-surface-hover focus:outline-none focus-visible:bg-surface-hover ${open ? "pr-2" : ""}`}
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

const Teasers = ({ count }: { count: number }) =>
  count > 0 ? (
    <>
      {Array.from({ length: Math.min(TEASERS, count) }, (_, i) => (
        <span
          key={i}
          className="group relative flex h-[88px] w-[76px] shrink-0 items-center justify-center outline-dashed outline-2 -outline-offset-2 outline-line-strong md:h-24 md:w-[84px]"
        >
          <PixelIcon name="mystery" size={32} className="opacity-60" />
          <Tip title="???" line={t("soon")} status="" tone="" />
        </span>
      ))}
    </>
  ) : null;

const Row = ({ kind, items, hidden, shop, onPick }: { kind: ItemKind; items: ShopItem[]; hidden: number; shop: Shop; onPick: (key: string) => void }) =>
  items.length || hidden ? (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{t(`rows.${kind}`)}</span>
        <span className="text-[11px] text-ink-faint">{t(`rowsHint.${kind}`)}</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {items.map((item) => (
          <Slot key={item.key} item={item} shop={shop} onPick={onPick} />
        ))}
        <Teasers count={hidden} />
      </div>
    </div>
  ) : null;

// her shop: what is held in a strip, then a row for each kind of thing still for sale. a hover says what an item is and a click opens its card
const ShopShelf = ({ shop, onPick }: Props) => {
  const owned = shop ? shop.items.filter((i) => i.owned) : [];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("title")}</span>
        {shop && (
          <span className="text-[13px] font-bold text-green-400">
            <Monetary value={shop.walletBalance} />
          </span>
        )}
      </div>
      {!shop && (
        <div className="flex gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={84} height={96} borderRadius={0} />
          ))}
        </div>
      )}
      {shop && owned.length > 0 && <OwnedStrip items={owned} shop={shop} onPick={onPick} />}
      {shop &&
        ROWS.map((kind) => (
          <Row
            key={kind}
            kind={kind}
            items={shop.items.filter((i) => i.kind === kind && !i.owned)}
            hidden={kind === "charm" ? 0 : shop.hidden?.[kind] ?? 0}
            shop={shop}
            onPick={onPick}
          />
        ))}
    </div>
  );
};

export default ShopShelf;
