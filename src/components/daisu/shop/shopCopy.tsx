import type { Shop, ShopItem } from "../../../services/daisu/ShopService";
import { kp } from "../potMath";
import i18n from "../../../i18n";

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.shop.${key}`, vars);

// the games a charm can be for, named the way the navbar names them
export const CHARM_GAME_KEYS: Record<string, string> = {
  dice: "dice.dice",
  crash: "nav.crash",
  slots: "nav.slots",
  plinko: "nav.plinko",
  blackjack: "blackjack.blackjack",
  mines: "mines.mines",
  hilo: "hilo.hilo",
  coinflip: "nav.coinFlip",
  cases: "daisu.shop.charm.cases",
  battles: "nav.caseBattles",
};

export interface ItemWords {
  name: string;
  what: string;
  about: string;
  pitch: string;
  opened: string;
}

// her words for an item: an unlock has its own, a boost has its own name and pitch over shared lines, a charm is all shared with the game filled in
export const itemWords = (item: Pick<ShopItem, "key" | "kind" | "xp" | "game">): ItemWords => {
  const pct = Math.round((item.xp || 0) * 100);
  if (item.kind === "boost") {
    return {
      name: t(`items.${item.key}.name`),
      what: t("boost.what", { pct }),
      about: t("boost.about", { pct }),
      pitch: t(`items.${item.key}.pitch`),
      opened: t("boost.opened", { pct }),
    };
  }
  if (item.kind === "charm") {
    const game = i18n.t(CHARM_GAME_KEYS[item.game || ""] || "");
    return {
      name: t("charm.name", { game }),
      what: t("charm.what", { game, pct }),
      about: t("charm.about", { game, pct }),
      pitch: t("charm.pitch", { game }),
      opened: t("charm.opened", { game }),
    };
  }
  return {
    name: t(`items.${item.key}.name`),
    what: t(`items.${item.key}.what`),
    about: t(`items.${item.key}.about`),
    pitch: t(`items.${item.key}.pitch`),
    opened: t(`items.${item.key}.opened`),
  };
};

// what a slot says about an item: held, out of reach by level, short of KP, or for sale
export const statusOf = (item: ShopItem, shop: Shop) => {
  if (item.owned) {
    const kept = item.via === "history" ? `${t("yours")} · ${t(`items.${item.key}.kept`)}` : t("yours");
    return { state: "owned", foot: t("yours"), tip: kept, tone: "text-green-400" };
  }
  if (shop.level < item.level) return { state: "locked", foot: t("level", { n: item.level }), tip: t("tipLevel", { n: item.level, level: shop.level }), tone: "text-accent-amber" };
  if (shop.walletBalance < item.price) return { state: "short", foot: kp(item.price), tip: t("tipShort", { price: kp(item.price), amount: kp(item.price - shop.walletBalance) }), tone: "text-ink-muted" };
  return { state: "open", foot: kp(item.price), tip: t("tipBuy", { price: kp(item.price), n: item.level }), tone: "text-accent-gold" };
};

export const Tip = ({ title, line, status, tone }: { title: string; line: string; status: string; tone: string }) => (
  <span
    role="tooltip"
    className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-raised hidden w-60 -translate-x-1/2 flex-col gap-1 bg-surface-nav px-3.5 py-3 text-left shadow-2xl md:group-hover:flex md:group-focus-visible:flex"
  >
    <b className="text-sm text-ink">{title}</b>
    <span className="text-xs leading-snug text-ink-soft">{line}</span>
    {status && <span className={`mt-1 text-xs font-bold ${tone}`}>{status}</span>}
  </span>
);
