import { useEffect } from "react";
import ShopArt from "./ShopArt";
import { loadShop, useShopState } from "./shopStore";
import { openDaisuShop } from "../tour/tourEvents";
import { kp } from "../potMath";
import i18n from "../../../i18n";

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.shop.items.chatPass.${key}`, vars);

// the chat's composer for an account in her beta without a chat pass. reading stays free
const LockedChat = () => {
  const shop = useShopState();
  const item = shop?.items.find((i) => i.key === "chatPass");

  useEffect(() => {
    loadShop();
  }, []);

  return (
    <div className="flex flex-col gap-2.5 border-t border-line bg-surface-nav px-3 py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center bg-surface">
          <ShopArt item="chatPass" size={20} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-bold leading-snug">{t("lockedTitle")}</span>
          {item && <span className="text-[11px] text-ink-muted">{t("lockedBody", { level: item.level, price: kp(item.price) })}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => openDaisuShop("chatPass")}
        className="h-[34px] rounded-md border-none bg-accent text-xs font-bold text-white hover:border-none hover:bg-accent-light focus:outline-none"
      >
        {t("getIt")}
      </button>
    </div>
  );
};

export default LockedChat;
