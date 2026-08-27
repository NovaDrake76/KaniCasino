import { useEffect, useRef, useState } from "react";
import { AiOutlineArrowUp } from "react-icons/ai";
import { IoMdClose } from "react-icons/io";
import i18n from "../i18n";

interface HintProps {
  // identifies this hint in storage, so a player who has seen one still gets the rest
  id: string;
  userId?: string;
  text: string;
  // whether the hint is relevant at all. it is checked once, the first time it is true.
  show: boolean;
  // what the hint is about, as a string. it is shown once per distinct value, so a token
  // that changes when the player earns something new arms it again and nothing else does.
  token: string;
}

const storageKey = (id: string, userId?: string) => `kani.hint.${userId || "anon"}.${id}`;

// One line, one arrow, pointing at the thing above it. Deliberately not a tour: a player
// who has just found the site does not need a guided sequence, they need the one control
// they are standing next to explained, once. Never show two at once on a screen.
const Hint: React.FC<HintProps> = ({ id, userId, text, show, token }) => {
  const [visible, setVisible] = useState(false);
  // the decision is made once per mount: without this, a re-render between the read and
  // the write would show the hint twice and record it once
  const decided = useRef(false);

  useEffect(() => {
    if (!show || decided.current) return;
    decided.current = true;

    let seen: string | null = null;
    try {
      seen = localStorage.getItem(storageKey(id, userId));
    } catch {
      // storage blocked: nothing was recorded, so nothing has been seen
    }
    if (seen === token) return;

    // marked on the way in rather than on dismissal, because closing the tab is the most
    // common way to leave and that still counts as having been shown
    try {
      localStorage.setItem(storageKey(id, userId), token);
    } catch {
      // it cannot be remembered, so it comes back next visit. better than never showing.
    }
    setVisible(true);
  }, [show, token, id, userId]);

  if (!visible) return null;

  return (
    <div className="animate-fade-in flex w-fit items-center gap-2 border-l-2 border-accent-gold bg-surface-raised py-1.5 pl-2 pr-1.5">
      <AiOutlineArrowUp className="animate-bounce shrink-0 text-accent-gold" />
      <span className="text-xs font-semibold text-white">{text}</span>
      <button
        onClick={() => setVisible(false)}
        aria-label={i18n.t("common.dismissHint")}
        className="rounded-none border-0 bg-transparent p-0 text-base leading-none text-ink-muted outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-accent-light"
      >
        <IoMdClose />
      </button>
    </div>
  );
};

export default Hint;
