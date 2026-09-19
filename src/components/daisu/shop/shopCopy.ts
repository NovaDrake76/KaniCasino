import type { ShopItem } from "../../../services/daisu/ShopService";
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
