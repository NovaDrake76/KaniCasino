import { createPortal } from "react-dom";
import type { UnlockKey } from "../../../services/daisu/ShopService";
import ShopArt from "./ShopArt";
import i18n from "../../../i18n";
import TypedText from "../TypedText";

interface Props {
  unlock: UnlockKey;
  onShowMe: () => void;
  onLater: () => void;
}

const t = (key: string) => i18n.t(`daisu.shop.${key}`);

// the item is theirs now, and she offers to show what it opened
const UnlockedCard = ({ unlock, onShowMe, onLater }: Props) =>
  createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center text-white md:items-center" style={{ background: "rgba(9, 7, 20, 0.78)" }}>
      <div
        role="dialog"
        aria-label={`${t("unlocked")} · ${t(`items.${unlock}.name`)}`}
        className="flex max-h-full w-full flex-col items-center gap-4 overflow-y-auto px-5 pb-6 pt-7 text-center shadow-2xl md:w-[500px] md:px-8 md:pb-[30px] md:pt-[34px]"
        style={{ background: "radial-gradient(90% 70% at 50% 0%, rgba(255, 204, 0, 0.16), transparent 70%), #212031" }}
      >
        <span className="flex h-[92px] w-[92px] items-center justify-center bg-surface-nav md:h-[110px] md:w-[110px]" style={{ boxShadow: "0 0 44px 8px rgba(255, 204, 0, 0.25)" }}>
          <ShopArt item={unlock} size={64} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">{t("unlocked")}</span>
        <span className="text-2xl font-extrabold leading-tight md:text-[28px]">{t(`items.${unlock}.name`)}</span>
        <div className="flex items-start gap-3 bg-surface-nav p-3 text-left">
          <img src="/images/daisu/bust.webp" alt="" className="h-10 w-10 shrink-0 object-contain object-top" />
          <p className="m-0 text-[13px] leading-normal text-ink-soft"><TypedText text={t(`items.${unlock}.opened`)} /></p>
        </div>
        <div className="flex w-full flex-col gap-2.5 md:flex-row">
          <button
            type="button"
            onClick={onShowMe}
            className="h-12 flex-1 rounded-md border-none bg-accent text-sm font-bold text-white hover:border-none hover:bg-accent-light focus:outline-none md:h-11"
          >
            {i18n.t("daisu.help.showMe")}
          </button>
          <button
            type="button"
            onClick={onLater}
            className="h-12 flex-1 rounded-md border-none bg-surface-nav text-sm font-semibold text-ink-soft hover:border-none hover:bg-surface-hover focus:outline-none md:h-11"
          >
            {i18n.t("daisu.tour.later")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

export default UnlockedCard;
