import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiChevronRight } from "react-icons/fi";
import BonusSection from "./BonusSection";
import type { BonusView } from "./Daisu.types";
import i18n from "../../i18n";

const WIDTH = 320;
const GAP = 8;

// a single line on her card; hovering it, or tapping it on a phone, shows the bonuses beside the card
const ActiveBonuses = ({ bonuses }: { bonuses: BonusView[] }) => {
  const anchor = useRef<HTMLButtonElement>(null);
  const [box, setBox] = useState<{ left: number; bottom: number } | null>(null);
  const live = bonuses.filter((b) => !b.expired);
  if (!live.length) return null;

  const show = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const left = r.left - WIDTH - GAP >= GAP ? r.left - WIDTH - GAP : Math.max(GAP, window.innerWidth - WIDTH - GAP);
    setBox({ left, bottom: Math.max(GAP, window.innerHeight - r.bottom) });
  };
  const hide = () => setBox(null);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (box ? hide() : show())}
        aria-expanded={!!box}
        className="flex w-full items-center justify-between gap-2 border-none bg-transparent px-0 py-1 text-left text-xs font-semibold text-accent-gold hover:border-none hover:text-accent-amber focus:outline-none"
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-accent-gold" />
          {i18n.t("daisu.activeBonuses", { count: live.length })}
        </span>
        <FiChevronRight aria-hidden />
      </button>
      {box &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[160] bg-surface p-3 text-white shadow-2xl"
            style={{ left: box.left, bottom: box.bottom, width: WIDTH }}
          >
            <BonusSection bonuses={bonuses} />
          </div>,
          document.body
        )}
    </>
  );
};

export default ActiveBonuses;
