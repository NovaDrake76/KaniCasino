import { useEffect } from "react";
import type { UnlockKey } from "../../../services/daisu/ShopService";
import ShopArt from "./ShopArt";
import { loadShop, useShopState } from "./shopStore";
import { openDaisuShop } from "../tour/tourEvents";
import { kp } from "../potMath";
import { track } from "../../../services/usage/usage";
import { useSeen } from "../../../services/usage/useSeen";
import i18n from "../../../i18n";

interface Props {
  unlock: UnlockKey;
  // stacked however wide the page is, for a narrow column
  compact?: boolean;
}

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.shop.${key}`, vars);

// a strip over a page the player can look through but not use yet: what it needs, and the way to her shop
const LockedBanner = ({ unlock, compact = false }: Props) => {
  const shop = useShopState();
  const item = shop?.items.find((i) => i.key === unlock);

  useEffect(() => {
    loadShop();
  }, []);

  const seen = useSeen<HTMLDivElement>(() => track("locked_view", { unlock }));

  return (
    <div
      ref={seen}
      className={`flex flex-col gap-3.5 p-4 ${compact ? "" : "md:flex-row md:items-center md:gap-[18px] md:px-5 md:py-[18px]"}`}
      style={{ background: "linear-gradient(rgba(255, 204, 0, 0.07), rgba(255, 204, 0, 0.07)), #212031" }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5 md:gap-[18px]">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center bg-surface-nav md:h-[60px] md:w-[60px]">
          <ShopArt item={unlock} size={34} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-extrabold leading-snug md:text-base">{t(`items.${unlock}.lockedTitle`)}</span>
          {item && (
            <span className="text-[13px] leading-snug text-ink-muted">{t(`items.${unlock}.lockedBody`, { price: kp(item.price), level: item.level })}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => openDaisuShop(unlock)}
        className={`h-11 shrink-0 rounded-md border-none bg-accent px-5 text-sm font-bold text-white hover:border-none hover:bg-accent-light focus:outline-none ${
          compact ? "w-full" : "w-full md:h-[42px] md:w-auto"
        }`}
      >
        {t(`items.${unlock}.getIt`)}
      </button>
    </div>
  );
};

export default LockedBanner;
