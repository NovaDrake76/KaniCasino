import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { TailSpin } from "react-loader-spinner";
import { FiCheck } from "react-icons/fi";
import Monetary from "../../Monetary";
import type { ShopItem } from "../../../services/daisu/ShopService";
import ShopArt from "./ShopArt";
import { itemWords } from "./shopCopy";
import { kp } from "../potMath";
import i18n from "../../../i18n";
import TypedText from "../TypedText";

interface Props {
  item: ShopItem;
  walletBalance: number;
  level: number;
  buying: boolean;
  onBuy: () => void;
  onClose: () => void;
  // an item already held has nothing to buy: its card offers to show where it is instead
  onShowMe?: () => void;
}

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.shop.${key}`, vars);

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-center justify-between gap-3 bg-surface-nav px-3.5 py-2.5 text-[13px]">
    <span className="text-ink-muted">{label}</span>
    {children}
  </div>
);

// what an item costs and opens, and her say on it, before any KP moves
const BuyCard = ({ item, walletBalance, level, buying, onBuy, onClose, onShowMe }: Props) => {
  const after = walletBalance - item.price;
  const short = after < 0;
  const tooLow = level < item.level;
  const words = itemWords(item);
  const name = words.name;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center text-white md:items-center" style={{ background: "rgba(9, 7, 20, 0.78)" }}>
      <div role="dialog" aria-label={name} className="flex max-h-full w-full flex-col gap-4 overflow-y-auto bg-surface p-5 shadow-2xl md:w-[460px] md:gap-[18px] md:p-7">
        <div className="flex items-center gap-4 md:gap-[18px]">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center bg-surface-nav md:h-24 md:w-24">
            <ShopArt item={item.key} game={item.game} size={56} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">{t("title")}</span>
            <span className="text-[22px] font-extrabold leading-tight md:text-2xl">{name}</span>
          </div>
        </div>
        <p className="m-0 text-sm leading-relaxed text-ink-soft">{words.about}</p>
        {item.owned ? (
          <span className="flex items-center gap-2 bg-surface-nav px-3.5 py-2.5 text-[13px] font-bold text-green-400">
            <FiCheck aria-hidden /> {t("yours")}
            {item.via === "history" && <span className="font-normal text-ink-faint">· {t(`items.${item.key}.kept`)}</span>}
          </span>
        ) : (
          <div className="flex flex-col gap-px bg-line">
            <Row label={t("price")}>
              <b className="text-accent-gold">
                <Monetary value={item.price} />
              </b>
            </Row>
            <Row label={t("needs")}>
              <b className={tooLow ? "text-accent-amber" : ""}>{t("level", { n: item.level })}</b>
            </Row>
            <Row label={t("after")}>
              <b className={short ? "text-red-400" : "text-green-400"}>{short ? t("short", { amount: kp(-after) }) : <Monetary value={after} />}</b>
            </Row>
          </div>
        )}
        <div className="flex items-start gap-3 bg-surface-nav p-3">
          <img src="/images/daisu/bust.webp" alt="" className="h-10 w-10 shrink-0 object-contain object-top" />
          <p className="m-0 text-[13px] leading-normal text-ink-soft"><TypedText text={item.owned ? words.opened : words.pitch} /></p>
        </div>
        <div className="flex flex-col gap-2">
          {item.owned ? (
            onShowMe && (
              <button
                type="button"
                onClick={onShowMe}
                className="flex h-12 items-center justify-center rounded-md border-none bg-accent text-sm font-bold text-white hover:border-none hover:bg-accent-light focus:outline-none md:h-11"
              >
                {i18n.t("daisu.help.showMe")}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onBuy}
              disabled={buying || short || tooLow}
              className="flex h-12 items-center justify-center rounded-md border-none bg-accent text-sm font-bold text-white hover:border-none hover:bg-accent-light focus:outline-none disabled:opacity-50 md:h-11"
            >
              {buying ? <TailSpin height="18" width="18" color="#ffffff" ariaLabel="buying" /> : t("buyFor", { amount: kp(item.price) })}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-md border-none bg-surface-nav text-[13px] font-semibold text-ink-soft hover:border-none hover:bg-surface-hover focus:outline-none md:h-10"
          >
            {t("notNow")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BuyCard;
