import { useContext } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import UserContext from "../../UserContext";
import i18n from "../../i18n";

// a limited account sees why above every page for as long as the limit stands; the rail offset keeps it beside the chat
const LimitedBanner = ({ shift }: { shift: number }) => {
  const { userData } = useContext(UserContext);
  const limited = userData?.limited;
  if (!limited) return null;

  return (
    <div className="w-full transition-[padding] duration-200" style={{ paddingLeft: shift }} data-testid="limited-banner">
      <div className="mx-4 mt-4 flex items-start gap-3.5 bg-surface p-4 md:mx-8 md:px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-surface-nav">
          <FiAlertTriangle className="text-[22px] text-red-400" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-bold leading-snug">{i18n.t("limited.title")}</span>
          {limited.reason && (
            <span className="break-words text-sm leading-snug text-ink-soft">{i18n.t("limited.reason", { reason: limited.reason })}</span>
          )}
          <span className="text-[13px] leading-snug text-ink-muted">{i18n.t("limited.what")}</span>
          <span className="text-[13px] leading-snug text-ink-muted">{i18n.t("limited.contact")}</span>
        </div>
      </div>
    </div>
  );
};

export default LimitedBanner;
