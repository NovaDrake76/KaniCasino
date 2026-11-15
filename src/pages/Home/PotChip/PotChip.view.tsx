import Monetary from "../../../components/Monetary";
import { PotChipViewProps } from "./PotChip.types";

// a phone tile has room for the amount alone. from sm the label joins it, and where the two still do not fit on one
// line the chip wraps upwards, so the amount takes the line and the label is clipped away
const PotChipView: React.FC<PotChipViewProps> = ({ pot }) =>
  pot ? (
    <span
      data-testid="lottery-pot"
      className="inline-flex h-5 max-w-full flex-wrap-reverse content-end gap-x-1 overflow-hidden rounded bg-surface-raised px-2 py-0.5 text-xs font-semibold leading-4 text-ink-soft"
    >
      <span className="hidden sm:inline">{pot.label}</span>{" "}
      <span className="whitespace-nowrap font-bold tabular-nums text-accent-gold">
        <Monetary value={pot.jackpot} />
      </span>
    </span>
  ) : null;

export default PotChipView;
