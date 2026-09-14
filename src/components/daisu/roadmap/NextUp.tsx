import Monetary from "../../Monetary";
import type { Roadmap } from "../../../services/daisu/RoadmapService";
import { MissionProgress, MissionTile } from "./missionLook";
import { missionWords } from "./missionCopy";
import { kp } from "../potMath";
import i18n from "../../../i18n";

interface Props {
  roadmap: Roadmap | null;
  claimingMission: string | null;
  bonusGame: { name: string; art?: string };
  onClaim: (key: string) => void;
  onHelp: (key: string) => void;
  onAll: () => void;
}

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.roadmap.${key}`, vars);

// her card's slice of the missions: the next one to do, and a reward waiting when there is one
const NextUp = ({ roadmap, claimingMission, bonusGame, onClaim, onHelp, onAll }: Props) => {
  if (!roadmap || roadmap.finished) return null;
  const next = roadmap.missions.find((m) => !m.complete);
  const ready = roadmap.missions.filter((m) => m.claimable);
  if (!next && !ready.length) return null;
  const done = roadmap.missions.filter((m) => m.complete).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t("nextUp")}</span>
        <button
          type="button"
          onClick={onAll}
          className="border-none bg-transparent p-0 text-[11px] font-semibold text-accent-light hover:border-none hover:text-ink focus:outline-none"
        >
          {t("allMissions")}
        </button>
      </div>
      {next && (
        <div className="flex flex-col gap-2.5 bg-surface-raised p-3">
          <div className="flex items-center gap-3">
            <MissionTile goal={next.goal} art={next.goal === "bonusSpent" ? bonusGame.art : undefined} small />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[13px] font-bold">{missionWords(next.key, next.target, bonusGame.name).title}</span>
              <span className="text-[11px] text-ink-muted">
                {t("chapterShort", { n: roadmap.chapter, done, total: roadmap.missions.length })}
              </span>
            </div>
            <b className="shrink-0 text-[13px] text-accent-gold">
              <Monetary value={next.reward} />
            </b>
          </div>
          {next.target > 1 && <MissionProgress current={next.current} target={next.target} />}
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onHelp(next.key)}
              className="h-8 rounded-md border-none bg-surface-nav px-3.5 text-xs font-bold text-ink-soft hover:border-none hover:bg-surface-hover focus:outline-none"
            >
              {t("help")}
            </button>
          </div>
        </div>
      )}
      {ready.length > 0 && (
        <button
          type="button"
          onClick={() => onClaim(ready[0].key)}
          disabled={!!claimingMission}
          className="flex items-center justify-between gap-2 border-none bg-accent-gold px-3 py-2 text-left text-[13px] font-bold text-[#2a2100] hover:border-none hover:bg-accent-amber focus:outline-none disabled:opacity-60"
        >
          <span>{t("rewardsWaiting", { n: ready.length })}</span>
          <span className="shrink-0 text-[11px] font-extrabold uppercase">{t("claimAmount", { amount: kp(ready[0].reward) })}</span>
        </button>
      )}
    </div>
  );
};

export default NextUp;
