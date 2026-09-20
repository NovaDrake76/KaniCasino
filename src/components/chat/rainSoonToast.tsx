import { toast } from "react-toastify";
import { BsCloudRain } from "react-icons/bs";
import { FiArrowRight } from "react-icons/fi";
import { CHAT_OPEN_EVENT } from "../daisu/tour/tourEvents";
import i18n from "../../i18n";

const TOAST_ID = "rain-soon";

// the pool can still grow in the last two minutes, so the figure is a floor
export function toastRainSoon(pool: number, minutes: number) {
  if (toast.isActive(TOAST_ID)) return;
  const open = () => window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT));
  toast(
    <div className="flex cursor-pointer items-center gap-3">
      <BsCloudRain className="shrink-0 text-3xl text-accent-light" />
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-semibold text-ink">{i18n.t("rain.aboutTo")}</span>
        <span className="text-xs text-ink-soft">{i18n.t("rain.soonToast", { amount: pool.toLocaleString("en-US"), minutes })}</span>
      </div>
      <span className="ml-auto flex shrink-0 items-center gap-1 text-xs font-medium text-accent-gold">
        {i18n.t("rain.openChat")} <FiArrowRight />
      </span>
    </div>,
    { toastId: TOAST_ID, autoClose: 15000, closeOnClick: true, onClick: open }
  );
}
