import { TailSpin } from "react-loader-spinner";
import { FiCheck, FiHelpCircle } from "react-icons/fi";
import Monetary from "../../Monetary";
import type { RoadmapMission } from "../../../services/daisu/RoadmapService";
import { MissionProgress, MissionTile } from "./missionLook";
import i18n from "../../../i18n";

interface Props {
  mission: RoadmapMission;
  words: { title: string; desc: string; help: string };
  art?: string;
  claiming: boolean;
  helpOpen: boolean;
  onClaim: (key: string) => void;
  onHelp: (key: string) => void;
}

const t = (key: string) => i18n.t(`daisu.roadmap.${key}`);
// a reward waiting glows gold over the card's own fill
const GLOW = { background: "linear-gradient(rgba(255, 204, 0, 0.07), rgba(255, 204, 0, 0.07)), #212031" };

const Action = ({ mission, claiming, helpOpen, onClaim, onHelp }: Omit<Props, "words" | "art">) => {
  if (mission.claimed) {
    return (
      <span className="flex h-9 items-center justify-center gap-1.5 text-xs font-semibold text-ink-muted md:w-24">
        <FiCheck /> {t("claimed")}
      </span>
    );
  }
  if (mission.claimable) {
    return (
      <button
        type="button"
        onClick={() => onClaim(mission.key)}
        disabled={claiming}
        className="flex h-11 items-center justify-center rounded-md border-none bg-accent-gold text-sm font-extrabold text-[#1b1400] hover:border-none hover:bg-accent-amber focus:outline-none disabled:opacity-60 md:h-[34px] md:w-24 md:text-[13px]"
      >
        {claiming ? <TailSpin height="16" width="16" color="#1b1400" ariaLabel="claiming" /> : t("claim")}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onHelp(mission.key)}
      aria-expanded={helpOpen}
      className={`flex h-11 items-center justify-center gap-1.5 rounded-md border-none text-sm font-bold hover:border-none focus:outline-none md:h-[34px] md:w-24 md:text-xs ${
        helpOpen ? "bg-surface-raised text-white" : "bg-surface-nav text-ink-soft hover:bg-surface-hover"
      }`}
    >
      {helpOpen ? (
        i18n.t("daisu.close")
      ) : (
        <>
          <FiHelpCircle /> {t("help")}
        </>
      )}
    </button>
  );
};

const MissionRow = ({ mission, words, art, claiming, helpOpen, onClaim, onHelp }: Props) => (
  <div className={`flex flex-col bg-surface ${mission.claimed ? "opacity-55" : ""}`} style={mission.claimable ? GLOW : undefined}>
    <div className="flex flex-col gap-2.5 p-3.5 md:flex-row md:items-center md:gap-3.5 md:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-3.5">
        <MissionTile goal={mission.goal} art={art} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-bold">{words.title}</span>
          <span className="text-xs leading-snug text-ink-muted">{words.desc}</span>
          {mission.target > 1 && !mission.claimed && <MissionProgress current={mission.current} target={mission.target} />}
        </div>
        <span className="shrink-0 self-start whitespace-nowrap text-sm font-extrabold text-accent-gold md:self-center">
          <Monetary value={mission.reward} />
        </span>
      </div>
      <Action mission={mission} claiming={claiming} helpOpen={helpOpen} onClaim={onClaim} onHelp={onHelp} />
    </div>
    {helpOpen && (
      <div className="mx-3.5 mb-3.5 flex gap-3.5 bg-surface-nav p-4 md:mx-4 md:mb-4">
        <img src="/images/daisu/bust.webp" alt="" className="h-[52px] w-[52px] shrink-0 object-contain object-top" />
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm leading-relaxed text-ink-soft">{words.help}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onHelp(mission.key)}
              className="h-9 rounded-md border-none bg-surface px-3.5 text-[13px] font-semibold text-ink-soft hover:border-none hover:bg-surface-hover focus:outline-none"
            >
              {t("gotIt")}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);

export default MissionRow;
