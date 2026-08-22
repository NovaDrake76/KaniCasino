import { Range, RANGES } from "./timeRange";
import i18n from "../i18n";

const ChartRange: React.FC<{ value: Range; onChange: (range: Range) => void }> = ({ value, onChange }) => (
  <div className="flex gap-0.5" role="group" aria-label={i18n.t("predictions.priceHistory")}>
    {RANGES.map((range) => (
      <button
        key={range}
        onClick={() => onChange(range)}
        className={`text-[11px] px-2 py-1 rounded transition-colors ${
          value === range ? "bg-surface-raised text-ink" : "bg-transparent text-ink-muted hover:text-ink"
        }`}
      >
        {range}
      </button>
    ))}
  </div>
);

export default ChartRange;
