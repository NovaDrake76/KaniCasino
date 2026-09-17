import { toast } from "react-toastify";
import { GiTrophyCup } from "react-icons/gi";
import { FiArrowRight } from "react-icons/fi";
import Monetary from "../../../components/Monetary";
import { navigateTo } from "../../../services/navigation";
import { whenStakeClears } from "../../../services/stakeGuard";
import { PendingMission } from "../../../services/missions/MissionService";
import { ROADMAP_CHANGED_EVENT } from "../../../services/daisu/RoadmapService";
import { showDaisu } from "../../../components/daisu/tour/tourEvents";
import i18n from "../../../i18n";

// the styled real-time "mission complete" toast, shown app-wide the moment a
// mission becomes claimable (server guarantees it fires once per mission). When a
// targetPath is given the whole toast is a link to the missions page.
export function toastMissionComplete(m: PendingMission, targetPath?: string) {
  // one of daisu's finished, so whatever shows her missions reads them again straight away
  if (m.roadmap) window.dispatchEvent(new CustomEvent(ROADMAP_CHANGED_EVENT));
  whenStakeClears(() => enqueue((done) => showMissionToast(m, targetPath, done)));
}

// one toast at a time: a burst of completions waits its turn instead of stacking up the corner
const waiting: Array<() => void> = [];
let showing = false;

const showNext = () => {
  const show = waiting.shift();
  showing = !!show;
  if (show) show();
};

function enqueue(show: (done: () => void) => void) {
  waiting.push(() => show(showNext));
  if (!showing) showNext();
}

function showMissionToast(m: PendingMission, targetPath: string | undefined, done: () => void) {
  const title = m.roadmap
    ? i18n.t(`daisu.roadmap.missions.${m.key}.title`, { target: (m.target ?? 0).toLocaleString("en-US") })
    : m.title;
  // her missions are claimed in her room, the rest wherever the link points
  const open = m.roadmap ? () => showDaisu("room") : targetPath ? () => navigateTo(targetPath) : undefined;
  toast(
    <div className={`flex items-center gap-3 ${open ? "cursor-pointer" : ""}`}>
      <GiTrophyCup className="text-3xl text-accent-gold shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] uppercase tracking-wide text-ink-muted">
          {i18n.t(m.achievement ? "daisu.achievements.unlocked" : "missions.missionComplete")}
        </span>
        <span className="text-sm font-semibold text-ink truncate">{title}</span>
        <span className="text-xs text-accent-gold font-medium">
          <Monetary value={m.reward} /> ready to claim
        </span>
      </div>
      {open && (
        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-accent-gold shrink-0">
          Claim <FiArrowRight />
        </span>
      )}
    </div>,
    {
      autoClose: 6000,
      closeOnClick: !!open,
      onClick: open,
      onClose: done,
    }
  );
}
