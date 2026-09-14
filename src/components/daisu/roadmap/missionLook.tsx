import type { IconType } from "react-icons";
import { FaCrown, FaGift, FaHeart, FaStore } from "react-icons/fa";
import { FiBookOpen, FiStar } from "react-icons/fi";
import { GiCash, GiCrossedSwords, GiHoneyJar, GiOpenTreasureChest, GiPerspectiveDiceSixFacesRandom, GiTwoCoins } from "react-icons/gi";
import type { RoadmapGoal } from "../../../services/daisu/RoadmapService";

const ICONS: Record<RoadmapGoal, IconType> = {
  fullPots: GiHoneyJar,
  pinned: FaHeart,
  bonusSpent: GiTwoCoins,
  level: FiStar,
  giftSpins: FaGift,
  itemsSold: GiCash,
  gamesTried: GiPerspectiveDiceSixFacesRandom,
  giftStreak: FaGift,
  marketTrades: FaStore,
  collectionVisits: FiBookOpen,
  casesOpened: GiOpenTreasureChest,
  collectionsCompleted: FiBookOpen,
  staked: GiTwoCoins,
  battlesWon: GiCrossedSwords,
  topFan: FaCrown,
};

// a mission's picture: the game's own art when it is about one game, an icon otherwise
export const MissionTile = ({ goal, art, small }: { goal: RoadmapGoal; art?: string; small?: boolean }) => {
  const Icon = ICONS[goal];
  return (
    <span className={`flex shrink-0 items-center justify-center bg-surface-nav ${small ? "h-10 w-10" : "h-11 w-11 md:h-12 md:w-12"}`}>
      {art ? (
        <img src={art} alt="" className="max-h-[70%] max-w-[80%] object-contain" />
      ) : (
        <Icon className={`${small ? "text-xl" : "text-2xl"} ${goal === "pinned" ? "text-[#e5308c]" : "text-accent-gold"}`} />
      )}
    </span>
  );
};

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
