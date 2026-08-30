import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaGift } from "react-icons/fa";
import { useGiftStatus } from "./useGiftReady";
import i18n from "../../i18n";

const DISMISSED_KEY = "kani.giftPromptDismissed";

// the prompt is dismissed for the rest of the site-day, never for good: the whole point is
// that it comes back tomorrow. the stored value is the cooldown it was dismissed against.
const dismissedFor = (nextAt: string | null) => {
  try {
    return !!nextAt && window.localStorage.getItem(DISMISSED_KEY) === nextAt;
  } catch {
    return false;
  }
};

const GiftPrompt = () => {
  const status = useGiftStatus();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(dismissedFor(status.nextAt));
  }, [status.nextAt]);

  const dismiss = () => {
    setDismissed(true);
    try {
      if (status.nextAt) window.localStorage.setItem(DISMISSED_KEY, status.nextAt);
    } catch {
      // a browser with storage blocked just gets the prompt back on the next page
    }
  };

  // nothing to nag about on the page that grants it
  if (!status.canSpin || dismissed || pathname.startsWith("/gift")) return null;

  return (
    <div className="fixed bottom-4 right-4 z-sticky flex max-w-[calc(100vw-2rem)] items-stretch bg-surface shadow-lg">
      <Link
        to="/gift"
        onClick={dismiss}
        className="flex items-center gap-3 py-3 pl-3 pr-4 hover:bg-surface-hover"
      >
        <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center bg-accent-gold text-[#2a2100]">
          <span className="absolute inset-0 animate-ping bg-accent-gold opacity-60" />
          <FaGift className="relative text-lg" />
        </span>
        <span className="flex min-w-0 flex-col text-left leading-tight">
          <span className="text-sm font-bold">{i18n.t("gift.promptTitle")}</span>
          <span className="truncate text-xs text-ink-soft">
            {status.keepsStreak
              ? i18n.t("gift.promptStreak", { count: status.nextStreak })
              : i18n.t("gift.promptStart")}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label={i18n.t("gift.promptDismiss")}
        className="px-3 text-ink-faint hover:bg-surface-hover hover:text-ink-soft"
      >
        x
      </button>
    </div>
  );
};

export default GiftPrompt;
