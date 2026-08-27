import { useState } from "react";
import { AiOutlineArrowUp } from "react-icons/ai";
import { IoMdClose } from "react-icons/io";
import i18n from "../i18n";

interface HintProps {
  // identifies this hint for the dismissal, so a player who closes one keeps the rest
  id: string;
  userId?: string;
  text: string;
  // the caller decides whether the hint is relevant right now. it should be a condition
  // the player's own next action clears, so the hint retires itself and nothing has to
  // remember that it was shown.
  show: boolean;
}

const key = (id: string, userId?: string) => `kani.hint.${userId || "anon"}.${id}`;

// One line, one arrow, pointing at the thing above it. Deliberately not a tour: a player
// who has just found the site does not need a guided sequence, they need the one control
// they are standing next to explained. Never show two at once on a screen.
const Hint: React.FC<HintProps> = ({ id, userId, text, show }) => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(key(id, userId));
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(key(id, userId), "1");
    } catch {
      // storage can be unavailable; the hint still goes away for the session
    }
  };

  if (!show || dismissed) return null;

  return (
    <div className="animate-fade-in flex w-fit items-center gap-2 border-l-2 border-accent-gold bg-surface-raised py-1.5 pl-2 pr-1.5">
      <AiOutlineArrowUp className="animate-bounce shrink-0 text-accent-gold" />
      <span className="text-xs font-semibold text-white">{text}</span>
      <button
        onClick={dismiss}
        aria-label={i18n.t("common.dismissHint")}
        className="rounded-none border-0 bg-transparent p-0 text-base leading-none text-ink-muted outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-accent-light"
      >
        <IoMdClose />
      </button>
    </div>
  );
};

export default Hint;
