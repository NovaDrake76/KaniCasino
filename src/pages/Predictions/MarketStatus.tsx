import { Market } from "../../services/predictions/PredictionService";
import { endsInLabel } from "./marketTime";
import i18n from "../../i18n";

const STYLES: Record<Market["status"], string> = {
  open: "bg-accent/20 text-accent-light",
  closed: "bg-surface-raised text-ink-muted",
  resolved: "bg-emerald-500/15 text-emerald-400",
  void: "bg-red-500/15 text-red-400",
};

export const StatusChip: React.FC<{ status: Market["status"] }> = ({ status }) => (
  <span className={`text-[11px] px-2 py-0.5 rounded uppercase tracking-wide ${STYLES[status]}`}>
    {i18n.t(`predictions.status.${status}`)}
  </span>
);

export const EndsIn: React.FC<{ endsAt?: string }> = ({ endsAt }) => {
  const label = endsInLabel(endsAt);
  return label ? <span className="text-ink-muted">{label}</span> : null;
};
