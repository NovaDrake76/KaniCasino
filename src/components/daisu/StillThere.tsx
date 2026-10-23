import i18n from "../../i18n";

interface Props {
  spot: { left: number; top: number };
  answering: boolean;
  onAnswer: () => void;
}

// her question in place of the jar's readout; the button lands somewhere new each time she asks
const StillThere: React.FC<Props> = ({ spot, answering, onAnswer }) => (
  <div className="flex flex-col gap-1">
    <p className="m-0 text-center text-xs text-ink-muted">{i18n.t("daisu.stillThere.hint")}</p>
    <div className="relative h-28">
      <button
        type="button"
        data-still-there
        onClick={onAnswer}
        disabled={answering}
        style={{ left: `${spot.left}%`, top: `${spot.top}%` }}
        className="absolute whitespace-nowrap border-none bg-accent px-4 py-2 text-sm font-bold text-white hover:border-none hover:bg-accent-light disabled:opacity-60"
      >
        {i18n.t("daisu.stillThere.button")}
      </button>
    </div>
  </div>
);

export default StillThere;
