interface OptionRowProps<T extends string | number> {
  label?: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

// the segmented picker behind every fixed choice in a game panel: risk level, bet count, and
// anything else that is a short list of equal options
function OptionRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
}: OptionRowProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-semibold text-ink-muted">{label}</span>}
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            disabled={disabled}
            className={`flex-1 py-1.5 rounded text-sm font-semibold capitalize transition-colors disabled:opacity-50 ${
              value === option ? "bg-surface-raised text-white" : "bg-surface-nav text-ink-muted hover:text-white"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default OptionRow;
