import { toast } from "react-toastify";
import { GiTrophyCup } from "react-icons/gi";
import { FiArrowRight } from "react-icons/fi";
import Monetary from "../../../components/Monetary";
import { navigateTo } from "../../../services/navigation";
import { PendingMission } from "../../../services/missions/MissionService";

// the styled real-time "mission complete" toast, shown app-wide the moment a
// mission becomes claimable (server guarantees it fires once per mission). When a
// targetPath is given the whole toast is a link to the missions page.
export function toastMissionComplete(m: PendingMission, targetPath?: string) {
  toast(
    <div className={`flex items-center gap-3 ${targetPath ? "cursor-pointer" : ""}`}>
      <GiTrophyCup className="text-3xl text-accent-gold shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">Mission complete</span>
        <span className="text-sm font-semibold text-ink truncate">{m.title}</span>
        <span className="text-xs text-accent-gold font-medium">
          <Monetary value={m.reward} /> ready to claim
        </span>
      </div>
      {targetPath && (
        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-accent-gold shrink-0">
          Claim <FiArrowRight />
        </span>
      )}
    </div>,
    {
      autoClose: 6000,
      closeOnClick: !!targetPath,
      onClick: targetPath ? () => navigateTo(targetPath) : undefined,
    }
  );
}
