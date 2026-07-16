import { TailSpin } from "react-loader-spinner";
import { FiCheck, FiLock } from "react-icons/fi";
import { FaDiscord, FaTwitter } from "react-icons/fa";
import MainButton from "../../../components/MainButton";
import Monetary from "../../../components/Monetary";
import { Mission } from "../../../services/missions/MissionService";
import { resolveMissionArt, MissionArtTile } from "../missionArt";

// both social links come from the frontend env (set VITE_X_URL on Render for prod)
const SOCIAL_URLS: Record<string, string> = {
  discord: (import.meta.env.VITE_DISCORD_INVITE as string) || "https://discord.gg/NMdYb2aBZK",
  x: (import.meta.env.VITE_X_URL as string) || "https://x.com/kani_casino",
};

interface Props {
  mission: Mission;
  claiming: boolean;
  claim: (key: string) => void;
  visit: (key: string, url: string) => void;
  caseImage?: string;
  endgame?: boolean;
}

const MissionCard: React.FC<Props> = ({ mission, claiming, claim, visit, caseImage, endgame }) => {
  const pct =
    mission.target > 0 ? Math.min(100, Math.round((mission.current / mission.target) * 100)) : 0;
  const showBar = mission.target > 1 && !mission.claimed;

  const cardClass = mission.claimed
    ? "bg-surface/60 border-line"
    : mission.claimable
    ? "bg-accent-gold/[0.06] border-accent-gold/60 ring-1 ring-accent-gold/20"
    : endgame
    ? "bg-[#e5308c]/[0.04] border-line border-l-4 border-l-[#e5308c] rounded-l-none"
    : "bg-surface border-line";

  return (
    <div
      className={`w-full rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${cardClass}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <MissionArtTile art={resolveMissionArt(mission.key, caseImage)} dim={mission.claimed} />
        <div className="flex flex-col min-w-0 flex-1 gap-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <span
              className={`flex-1 min-w-0 truncate text-sm font-semibold ${
                mission.claimed ? "text-ink-muted" : "text-ink"
              }`}
            >
              {mission.title}
            </span>
            <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-accent-gold">
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
      </div>

      <div className="w-full sm:w-28 shrink-0">
        {mission.claimed ? (
          <span className="flex items-center justify-center gap-1 h-10 text-sm text-ink-muted">
            <FiCheck /> Claimed
          </span>
        ) : mission.claimable ? (
          <button
            onClick={() => claim(mission.key)}
            disabled={claiming}
            className="w-full h-10 rounded-md text-sm font-semibold bg-accent-gold text-black hover:bg-accent-amber disabled:opacity-50 flex items-center justify-center gap-1 transition-colors"
          >
            {claiming ? <TailSpin height="18" width="18" color="#000" ariaLabel="claiming" /> : "Claim"}
          </button>
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
