import { useState } from "react";
import { FiX } from "react-icons/fi";
import i18n from "../../i18n";

const SEEN_KEY = "kani.coinPurpleSeen";

interface Props {
  // read off the round the server sent, so the note can never quote odds the game is not running
  chance: number;
  purple: number;
}

// the coin grew a third side, so it is introduced once rather than left to be discovered
// by losing to it. storage can be blocked; then it shows each visit, which is harmless
const PurpleNote = ({ chance, purple }: Props) => {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(SEEN_KEY);
    } catch {
      return true;
    }
  });

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // nothing to do: it still closes for this visit
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="relative flex w-full items-start gap-3 border border-violet-500/40 bg-violet-500/10 p-3.5">
      <img src="/images/coinPurple.webp" alt="" className="h-11 w-11 shrink-0 object-contain" />
      <div className="flex flex-col gap-1 pr-6">
        <span className="text-sm font-bold text-violet-100">{i18n.t("coin.purpleNewTitle")}</span>
        <span className="text-xs leading-relaxed text-ink-soft">
          {i18n.t("coin.purpleNewBody", { chance: Math.round(chance * 100), mult: purple })}
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={i18n.t("daisu.close")}
        className="absolute right-1.5 top-1.5 border-none bg-transparent p-1.5 text-ink-faint hover:border-none hover:text-ink-soft focus:outline-none"
      >
        <FiX />
      </button>
    </div>
  );
};

export default PurpleNote;
