import Monetary from "../Monetary";
import i18n from "../../i18n";

interface BetAmountProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onHalve: () => void;
  onDouble: () => void;
  // pass onMax to show the Max button; games that do not cap the bet leave it out
  onMax?: () => void;
  betValue: number;
  disabled?: boolean;
  label?: string;
  hint?: React.ReactNode;
}

// the bet field every game shares: one input plus the ½ / 2× steppers, and Max when offered
const BetAmount: React.FC<BetAmountProps> = ({
  value,
  onChange,
  onBlur,
  onHalve,
  onDouble,
  onMax,
  betValue,
  disabled,
  label,
  hint,
}) => {
  const steps = [
    { key: "half", text: "½", run: onHalve },
    { key: "double", text: "2×", run: onDouble },
    ...(onMax ? [{ key: "max", text: i18n.t("common.max"), run: onMax }] : []),
  ];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
        <span>{label || i18n.t("common.betAmount")}</span>
        <span><Monetary value={betValue} /></span>
      </div>
      <div className="flex">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={onBlur}
          disabled={disabled}
          // size 1 drops the input's default 20-character intrinsic width, which flex cannot
          // shrink past and which pushed the whole page wider than a phone
          size={1}
          className="p-2 bg-surface-nav border border-line rounded-l rounded-r-none w-full min-w-0 text-sm disabled:opacity-50"
        />
        {steps.map((step, i) => (
          <button
            key={step.key}
            onClick={step.run}
            disabled={disabled}
            className={`px-3 bg-surface-raised hover:bg-surface-hover text-sm font-semibold disabled:opacity-50 ${
              i === steps.length - 1
                ? "border border-line rounded-r rounded-l-none"
                : "border-y border-line rounded-none"
            }`}
          >
            {step.text}
          </button>
        ))}
      </div>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  );
};

export default BetAmount;
