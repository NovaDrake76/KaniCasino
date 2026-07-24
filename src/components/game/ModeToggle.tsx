const MODES = ["manual", "auto"] as const;

interface ModeToggleProps {
  mode: "manual" | "auto";
  setMode: (mode: "manual" | "auto") => void;
  manualDisabled?: boolean;
  autoDisabled?: boolean;
}

const ModeToggle: React.FC<ModeToggleProps> = ({ mode, setMode, manualDisabled, autoDisabled }) => (
  <div className="flex bg-surface-nav rounded p-1 text-sm font-semibold">
    {MODES.map((m) => (
      <button
        key={m}
        onClick={() => setMode(m)}
        disabled={m === "manual" ? manualDisabled : autoDisabled}
        className={`flex-1 py-1.5 rounded capitalize transition-colors disabled:opacity-50 ${
          mode === m ? "bg-surface-raised text-white" : "text-ink-muted hover:text-white"
        }`}
      >
        {m}
      </button>
    ))}
  </div>
);

export default ModeToggle;
