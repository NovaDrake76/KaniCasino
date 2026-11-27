import i18n from "../../i18n";

interface SkipAnimationSwitchProps {
  held: boolean;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
}

const SkipAnimationSwitch = ({ held, on, onChange, disabled }: SkipAnimationSwitchProps) => {
  if (!held) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold">{i18n.t("casePage.skipAnimation")}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={i18n.t("casePage.skipAnimation")}
        onClick={() => onChange(!on)}
        disabled={disabled}
        className={`relative w-12 h-6 shrink-0 p-0 rounded-full border border-line hover:border-line transition-colors disabled:opacity-50 ${on ? "bg-accent" : "bg-surface-nav"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-6" : ""}`} />
      </button>
    </div>
  );
};

export default SkipAnimationSwitch;
