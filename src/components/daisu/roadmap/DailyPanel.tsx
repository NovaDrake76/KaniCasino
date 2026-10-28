import { useEffect, useState } from "react";
import type { Daily } from "../../../services/daisu/RoadmapService";
import MissionRow from "./MissionRow";
import { GAME_ART, GAME_NAME_KEYS } from "../potMath";
import { serverNow } from "../../../services/serverClock";
import i18n from "../../../i18n";

interface Props {
  daily: Daily;
  claimingMission: string | null;
  helpKey: string | null;
  bonusGame: { name: string; art?: string };
  onClaim: (key: string) => void;
  onHelp: (key: string) => void;
}

const t = (key: string, vars?: Record<string, string | number>) => i18n.t(`daisu.daily.${key}`, vars);

// crash and coin flip are never her picks, so their names and art are added here
const GAME_NAMES: Record<string, string> = { ...GAME_NAME_KEYS, crash: "nav.crash", coinflip: "nav.coinFlip" };
const GAME_PICTURES: Record<string, string> = { ...GAME_ART, coinflip: "/images/coinHeads.webp" };

const untilReset = (resetsAt: string) => {
  const s = Math.max(0, Math.ceil((Date.parse(resetsAt) - serverNow()) / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

const ResetClock = ({ resetsAt }: { resetsAt: string }) => {
  const [left, setLeft] = useState(() => untilReset(resetsAt));
  useEffect(() => {
    setLeft(untilReset(resetsAt));
    const id = setInterval(() => setLeft(untilReset(resetsAt)), 1000);
    return () => clearInterval(id);
  }, [resetsAt]);
  return <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">{t("resets", { time: left })}</span>;
};

// her three requests for today, above the chapter; claims and help keys carry a prefix so they never meet a chapter mission's
const DailyPanel = ({ daily, claimingMission, helpKey, bonusGame, onClaim, onHelp }: Props) => (
  <div className="flex flex-col gap-3.5">
    <div className="flex items-center justify-between gap-4 bg-surface px-4 py-3.5 md:px-5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-accent-gold">{t("title")}</span>
      <ResetClock resetsAt={daily.resetsAt} />
    </div>
    {daily.missions.map((m) => {
      const game = m.goal === "bonusSpent" ? bonusGame.name : m.game ? i18n.t(GAME_NAMES[m.game]) : "";
      const vars = { target: m.target.toLocaleString("en-US"), game };
      return (
        <MissionRow
          key={m.key}
          mission={m}
          words={{ title: t(`goals.${m.goal}.title`, vars), desc: t(`goals.${m.goal}.desc`, vars), help: t(`goals.${m.goal}.help`, vars) }}
          art={m.goal === "bonusSpent" ? bonusGame.art : m.game ? GAME_PICTURES[m.game] : undefined}
          claiming={claimingMission === `daily:${m.key}`}
          helpOpen={helpKey === `daily:${m.key}`}
          onClaim={onClaim}
          onHelp={(key) => onHelp(`daily:${key}`)}
        />
      );
    })}
  </div>
);

export default DailyPanel;
