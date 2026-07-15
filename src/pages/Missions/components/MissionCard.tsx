import { FiCheck, FiLock } from "react-icons/fi";
import { FaDiscord, FaTwitter } from "react-icons/fa";
import MainButton from "../../../components/MainButton";
import Monetary from "../../../components/Monetary";
import { Mission } from "../../../services/missions/MissionService";

// discord invite comes from the frontend env; the x handle is a plain constant to edit
const SOCIAL_URLS: Record<string, string> = {
  discord: (import.meta.env.VITE_DISCORD_INVITE as string) || "https://discord.gg",
  x: "https://x.com/kanicasino",
};

interface Props {
  mission: Mission;
  claiming: boolean;
  claim: (key: string) => void;
  visit: (key: string, url: string) => void;
}

const MissionCard: React.FC<Props> = ({ mission, claiming, claim, visit }) => {
  const pct =
    mission.target > 0 ? Math.min(100, Math.round((mission.current / mission.target) * 100)) : 0;
  const showBar = mission.target > 1 && !mission.claimed;

  return (
    <div
      className={`w-full rounded-xl border p-4 flex items-center gap-4 transition-colors ${
        mission.claimed
          ? "bg-surface/60 border-line"
          : mission.claimable
          ? "bg-surface border-accent-gold/40"
          : "bg-surface border-line"
      }`}
    >
      <div className="flex flex-col min-w-0 flex-1 gap-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${mission.claimed ? "text-ink-muted" : "text-ink"}`}>
            {mission.title}
          </span>
          <span className="text-xs text-accent-gold font-medium">
            <Monetary value={mission.reward} />
          </span>
        </div>
        <span className="text-xs text-ink-muted">{mission.description}</span>
        {showBar && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-surface-nav overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] text-ink-muted shrink-0">
              {mission.current}/{mission.target}
            </span>
          </div>
        )}
      </div>

      <div className="w-36 shrink-0">
        {mission.claimed ? (
          <span className="flex items-center justify-center gap-1 h-10 text-sm text-ink-muted">
            <FiCheck /> Claimed
          </span>
        ) : mission.claimable ? (
          <MainButton
            text={<span className="flex items-center gap-1">Claim</span>}
            onClick={() => claim(mission.key)}
            type="success"
            loading={claiming}
            disabled={claiming}
            textSize="text-sm"
          />
        ) : mission.social ? (
          <MainButton
            text={mission.social === "discord" ? "Join" : "Follow"}
            onClick={() => visit(mission.key, SOCIAL_URLS[mission.social as string])}
            icon={mission.social === "discord" ? <FaDiscord /> : <FaTwitter />}
            type="info"
            textSize="text-sm"
          />
        ) : (
          <span className="flex items-center justify-center gap-1 h-10 text-xs text-ink-faint">
            <FiLock /> Locked
          </span>
        )}
      </div>
    </div>
  );
};

export default MissionCard;
