import i18n from "../../i18n";
import { binChance, formatChance } from "./plinkoBoard";

const EDGE = 4;

// a small chip under the hovered box; x and y are the box's bottom center inside the board's container
const BinChance = ({ bin, x, y, width }: { bin: number; x: number; y: number; width: number }) => {
  const text = formatChance(binChance(bin));
  const half = (text.length * 7 + 16) / 2;
  const left = Math.min(Math.max(x, half + EDGE), width - half - EDGE);
  return (
    <div
      role="tooltip"
      aria-label={`${text} ${i18n.t("plinko.landChance")}`}
      className="pointer-events-none absolute z-raised -translate-x-1/2 whitespace-nowrap bg-surface-nav px-2 py-1 text-xs font-bold tabular-nums text-ink shadow-lg"
      style={{ left, top: y + 7 }}
    >
      <span
        className="absolute -top-1 h-2 w-2 -translate-x-1/2 rotate-45 bg-surface-nav"
        style={{ left: `calc(50% + ${x - left}px)` }}
      />
      {text}
    </div>
  );
};

export default BinChance;
