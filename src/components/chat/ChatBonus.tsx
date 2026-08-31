import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaGift } from "react-icons/fa";
import UserContext from "../../UserContext";
import i18n from "../../i18n";

// the bonus countdown, mirrored at the top of the chat. it is not moved out of the navbar:
// a collapsed panel would then hide the most used control on the site, and the ad offer
// that rides alongside it would lose its impressions. this is the reason to keep the panel
// open, and the navbar stays the reason it can always be claimed.
const ChatBonus = ({ onOpenBonus }: { onOpenBonus?: () => void }) => {
  const { userData } = useContext(UserContext);
  const [left, setLeft] = useState("");

  useEffect(() => {
    if (!userData?.nextBonus) return setLeft("");
    const tick = () => {
      const diff = new Date(userData.nextBonus).getTime() - Date.now();
      setLeft(diff <= 0 ? "" : new Date(Math.floor(diff / 1000) * 1000).toISOString().substring(14, 19));
      return diff <= 0;
    };
    if (tick()) return;
    const timer: ReturnType<typeof setInterval> = setInterval(() => {
      if (tick()) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [userData?.nextBonus]);

  if (!userData) return null;
  const ready = !left;

  return (
    <button
      type="button"
      onClick={onOpenBonus}
      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left ${
        ready ? "bg-accent-gold text-[#2a2100] hover:brightness-110" : "bg-surface-nav hover:bg-surface"
      }`}
    >
      <FaGift className={ready ? "text-base" : "text-base text-ink-faint"} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
          {ready ? i18n.t("chat.bonusReady") : i18n.t("chat.bonusIn")}
        </span>
        {!ready && <span className="font-mono text-sm font-bold text-accent-gold">{left}</span>}
      </span>
    </button>
  );
};

export const ChatBonusLink = () => (
  <Link to="/" className="block text-xs text-ink-muted hover:text-ink-soft">
    {i18n.t("chat.bonusHint")}
  </Link>
);

export default ChatBonus;
