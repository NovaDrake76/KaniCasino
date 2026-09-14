import { useEffect } from "react";
import { FiLock } from "react-icons/fi";
import Monetary from "../../Monetary";
import type { UnlockKey } from "../../../services/daisu/ShopService";
import { loadShop, useShopState } from "./shopStore";
import { openDaisuShop } from "../tour/tourEvents";
import i18n from "../../../i18n";

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.shop.${key}`, vars);

// a page her shop has not opened for this account: the shape of what is behind it, what it takes,
// and the way to her shop
const LockedPanel = ({ unlock }: { unlock: UnlockKey }) => {
  const shop = useShopState();
  const item = shop?.items.find((i) => i.key === unlock);

  useEffect(() => {
    loadShop();
  }, []);

  return (
    <div className="relative min-h-[440px] w-full md:min-h-[540px]" data-tour="locked-panel">
      <div aria-hidden className="grid grid-cols-2 gap-3 opacity-20 grayscale md:grid-cols-6 md:gap-[18px]">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={`h-[180px] bg-surface md:h-[212px] ${i > 3 ? "hidden md:block" : ""}`} />
        ))}
      </div>
      <div className="absolute inset-x-0 top-8 flex justify-center md:top-[70px]">
        <div className="flex w-full max-w-[540px] flex-col items-center gap-3 bg-surface px-5 py-6 text-center shadow-2xl md:gap-3.5 md:p-8">
          <span className="flex h-14 w-14 items-center justify-center bg-surface-nav md:h-16 md:w-16">
            <FiLock className="text-[26px] text-accent-gold md:text-[30px]" />
          </span>
          <span className="text-xl font-extrabold md:text-2xl">{t(`items.${unlock}.lockedTitle`)}</span>
          <p className="m-0 text-sm leading-relaxed text-ink-soft">{t(`items.${unlock}.lockedBody`)}</p>
          {item && (
            <div className="flex flex-wrap justify-center gap-1.5 md:gap-2">
              <span className="hidden bg-surface-raised px-2.5 py-[5px] text-xs font-bold md:inline">{t(`items.${unlock}.name`)}</span>
              <span className="bg-surface-raised px-2.5 py-[5px] text-xs font-bold text-ink-soft">{t("level", { n: item.level })}</span>
              <span className="bg-surface-raised px-2.5 py-[5px] text-xs font-extrabold text-accent-gold">
                <Monetary value={item.price} />
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => openDaisuShop(unlock)}
            className="h-12 w-full rounded-md border-none bg-accent px-[22px] text-[15px] font-bold text-white hover:border-none hover:bg-accent-light focus:outline-none md:h-11 md:w-auto md:text-sm"
          >
            {t(`items.${unlock}.getIt`)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LockedPanel;
