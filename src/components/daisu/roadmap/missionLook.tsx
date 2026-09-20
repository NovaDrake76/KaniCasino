import type { RoadmapGoal } from "../../../services/daisu/RoadmapService";
import PixelIcon, { PixelIconName } from "../PixelIcon";

const ICONS: Record<RoadmapGoal, PixelIconName> = {
  fullPots: "jar",
  pinned: "heart",
  bonusSpent: "ticket",
  level: "star",
  giftSpins: "gift",
  itemsSold: "bag",
  gamesTried: "dice",
  giftStreak: "flame",
  marketTrades: "trade",
  collectionVisits: "lens",
  casesOpened: "chest",
  collectionsCompleted: "medal",
  staked: "coins",
  battlesWon: "swords",
  topFan: "crown",
  discordLinked: "chat",
  daysPlayed: "calendar",
  bigWin: "trophy",
  rainsCaught: "drop",
  referrals: "people",
  predictions: "crystal",
};

// a mission's picture: the game's own art when it is about one game, a pixel icon otherwise
export const MissionTile = ({ goal, art, small }: { goal: RoadmapGoal; art?: string; small?: boolean }) => (
  <span className={`flex shrink-0 items-center justify-center bg-surface-nav ${small ? "h-10 w-10" : "h-11 w-11 md:h-12 md:w-12"}`}>
    {art ? <img src={art} alt="" className="max-h-[70%] max-w-[80%] object-contain" /> : <PixelIcon name={ICONS[goal]} size={32} />}
  </span>
);

export const MissionProgress = ({ current, target }: { current: number; target: number }) => (
  <div className="flex items-center gap-2.5">
    <div className="h-1.5 flex-1 bg-surface-nav">
      <div className="h-full bg-accent" style={{ width: `${Math.min(100, Math.round((current / target) * 100))}%` }} />
    </div>
    <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">
      {`${current.toLocaleString("en-US")} / ${target.toLocaleString("en-US")}`}
    </span>
  </div>
);
