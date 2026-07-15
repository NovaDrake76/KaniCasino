import { toast } from "react-toastify";
import { GiTrophyCup } from "react-icons/gi";
import Monetary from "../../../components/Monetary";
import { PendingMission } from "../../../services/missions/MissionService";

// the styled real-time "mission complete" toast, shown app-wide the moment a
// mission becomes claimable (server guarantees it fires once per mission).
export function toastMissionComplete(m: PendingMission) {
  toast(
    <div className="flex items-center gap-3">
      <GiTrophyCup className="text-3xl text-accent-gold shrink-0" />
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">Mission complete</span>
        <span className="text-sm font-semibold text-ink">{m.title}</span>
        <span className="text-xs text-accent-gold font-medium">
          <Monetary value={m.reward} /> ready to claim
        </span>
      </div>
    </div>,
    { autoClose: 6000 }
  );
}
