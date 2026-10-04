import { FiShield } from "react-icons/fi";
import { lockDate, useVerification } from "./useVerification";
import { openVerify, VerifyFeature } from "./verifyEvents";
import i18n from "../../i18n";

interface Props {
  feature: VerifyFeature;
  // stacked however wide the page is, for a narrow column
  compact?: boolean;
  className?: string;
}

// a strip over a page that needs a verified account: before the lock date it warns, from it it says why the page
// will not let them in. nothing at all for a guest or a verified account.
const VerifyBanner = ({ feature, compact = false, className = "" }: Props) => {
  const { needed, enforced, from } = useVerification();
  if (!needed || !from) return null;

  const title = enforced
    ? i18n.t(`verify.locked.${feature}`)
    : i18n.t(`verify.soon.${feature}`, { date: lockDate(from) });

  return (
    <div
      className={`flex w-full flex-col gap-3 bg-surface p-4 ${compact ? "" : "md:flex-row md:items-center md:gap-[18px] md:px-5"} ${className}`}
      data-testid="verify-banner"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-surface-nav">
          <FiShield className={`text-[22px] ${enforced ? "text-accent-amber" : "text-accent"}`} />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[15px] font-bold leading-snug">{title}</span>
          <span className="text-[13px] leading-snug text-ink-muted">{i18n.t("verify.how")}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={openVerify}
        className={`h-11 shrink-0 rounded-md border-none bg-accent px-5 text-sm font-bold text-white hover:border-none hover:bg-accent-light focus:outline-none ${
          compact ? "w-full" : "w-full md:h-[42px] md:w-auto"
        }`}
      >
        {i18n.t("verify.button")}
      </button>
    </div>
  );
};

export default VerifyBanner;
