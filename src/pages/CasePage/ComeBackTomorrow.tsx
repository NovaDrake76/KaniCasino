import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaGift } from "react-icons/fa";
import UserContext from "../../UserContext";
import { useGiftStatus } from "../../components/header/useGiftReady";
import i18n from "../../i18n";

// once per account: the first case is the moment to say there is a tomorrow, and saying it
// on every open would turn it into furniture
const seenKey = (userId: string) => `kani.firstOpenNudge.${userId}`;

const wasSeen = (userId: string) => {
  try {
    return window.localStorage.getItem(seenKey(userId)) === "1";
  } catch {
    return true;
  }
};

const markSeen = (userId: string) => {
  try {
    window.localStorage.setItem(seenKey(userId), "1");
  } catch {
    // storage blocked: it shows again next time, which is the lesser problem
  }
};

interface Props {
  // the prize is on screen: the one moment a new player has just been given something
  show: boolean;
}

// half of new players leave inside three minutes with balance still in hand, before
// anything has told them the site has a tomorrow. this is that, at the one moment they
// are listening: the daily gift, and what day of it they would be on if they came back.
const ComeBackTomorrow = ({ show }: Props) => {
  const { userData } = useContext(UserContext);
  const status = useGiftStatus();
  const userId: string | undefined = userData?.id;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!show || !userId || open || wasSeen(userId)) return;
    markSeen(userId);
    setOpen(true);
  }, [show, userId, open]);

  if (!open || !userId) return null;

  const ready = status.canSpin;

  return (
    <div className="mt-6 flex w-full max-w-md items-stretch bg-surface shadow-lg">
      <div className="flex flex-1 items-center gap-3 py-3 pl-3 pr-4">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-accent-gold text-[#2a2100]">
          <FaGift className="text-lg" />
        </span>
        <span className="flex min-w-0 flex-col text-left leading-tight">
          <span className="text-sm font-bold">
            {ready ? i18n.t("gift.nudgeReadyTitle") : i18n.t("gift.nudgeLaterTitle")}
          </span>
          <span className="text-xs text-ink-soft">
            {ready
              ? i18n.t("gift.nudgeReadyLine")
              : i18n.t("gift.nudgeLaterLine", { day: status.nextStreak })}
          </span>
          <Link
            to="/gift"
            onClick={() => setOpen(false)}
            className="mt-2 self-start bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4338CA]"
          >
            {ready ? i18n.t("gift.spinTheDailyGift") : i18n.t("gift.nudgeSee")}
          </Link>
        </span>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label={i18n.t("gift.promptDismiss")}
        className="border-none bg-transparent px-3 text-ink-faint hover:border-none hover:bg-surface-hover hover:text-ink-soft"
      >
        x
      </button>
    </div>
  );
};

export default ComeBackTomorrow;
