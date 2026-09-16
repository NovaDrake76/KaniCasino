import Skeleton from "react-loading-skeleton";
import { FiLock } from "react-icons/fi";
import type { Roadmap } from "../../../services/daisu/RoadmapService";
import MissionRow from "./MissionRow";
import { chapterName, missionWords } from "./missionCopy";
import i18n from "../../../i18n";

interface Props {
  roadmap: Roadmap | null;
  claimingMission: string | null;
  helpKey: string | null;
  bonusGame: { name: string; art?: string };
  onClaim: (key: string) => void;
  onHelp: (key: string) => void;
  onShowMe?: (key: string) => void;
}

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.roadmap.${key}`, vars);

const ChapterHeader = ({ roadmap }: { roadmap: Roadmap }) => {
  const done = roadmap.missions.filter((m) => m.complete).length;
  return (
    <div className="flex items-center justify-between gap-4 bg-surface px-4 py-3.5 md:px-5 md:py-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">{t("chapter", { n: roadmap.chapter })}</span>
        <span className="text-[19px] font-extrabold leading-tight md:text-[22px]">{t(`chapters.${roadmap.chapter}`)}</span>
      </div>
      <span className="shrink-0 text-xs font-semibold text-ink-soft">{t("progress", { done, total: roadmap.missions.length })}</span>
    </div>
  );
};

const NextChapter = ({ roadmap }: { roadmap: Roadmap }) =>
  roadmap.next && (
    <div className="flex items-center gap-3.5 bg-surface-nav px-4 py-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-surface-page md:h-12 md:w-12">
        <FiLock className="text-xl text-ink-faint" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{chapterName(roadmap.next.chapter)}</span>
        <span className="text-xs leading-snug text-ink-faint">{t("locked")}</span>
      </div>
    </div>
  );

const Finished = () => (
  <div className="flex items-center gap-4 bg-surface p-5">
    <img src="/images/daisu/bust.webp" alt="" className="h-14 w-14 shrink-0 object-contain object-top" />
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">{t("finishedTitle")}</span>
      <p className="m-0 text-sm leading-relaxed text-ink-soft">{t("finishedLine")}</p>
    </div>
  </div>
);

// her room's missions tab: the open chapter, one row per mission, and the chapter after it, locked
const RoadmapPanel = ({ roadmap, claimingMission, helpKey, bonusGame, onClaim, onHelp, onShowMe }: Props) => {
  if (!roadmap) {
    return (
      <div className="flex flex-col gap-3.5">
        {[96, 76, 76, 76, 76].map((height, i) => (
          <Skeleton key={i} height={height} borderRadius={0} />
        ))}
      </div>
    );
  }
  if (roadmap.finished) return <Finished />;
  return (
    <div className="flex flex-col gap-3.5">
      <ChapterHeader roadmap={roadmap} />
      {roadmap.missions.map((m) => (
        <MissionRow
          key={m.key}
          mission={m}
          words={missionWords(m.key, m.target, bonusGame.name)}
          art={m.goal === "bonusSpent" ? bonusGame.art : undefined}
          claiming={claimingMission === m.key}
          helpOpen={helpKey === m.key}
          onClaim={onClaim}
          onHelp={onHelp}
          onShowMe={onShowMe}
        />
      ))}
      <NextChapter roadmap={roadmap} />
    </div>
  );
};

export default RoadmapPanel;
